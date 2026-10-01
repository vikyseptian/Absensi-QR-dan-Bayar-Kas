let intervalTimer;

// URL Google Apps Script milikmu yang baru
const API_URL = "https://script.google.com/macros/s/AKfycbwgF8tpaT-X0EFIOA38CFvuoV7bvhZvJbPRvrU0nbjsjEOdIwCXU4uSUGc_r1B5xXM1/exec";

// ==========================================
// 1. LOGIKA ABSENSI QR
// ==========================================

function login() {
    let nama = document.getElementById("nama").value.trim();
    let nim = document.getElementById("nim").value.trim();

    if (nama === "" || nim === "") {
        alert("Nama dan NIM wajib diisi!");
        return;
    }

    localStorage.setItem("nama", nama);
    localStorage.setItem("nim", nim);

    window.location.href = "scan.html";
}

function startScanner() {
    let sudahScan = false;

    function onScanSuccess(decodedText) {
        if(sudahScan){
            return;
        }

        sudahScan = true;

        let dataQR;

        try {
            dataQR = JSON.parse(decodedText);
        } catch {
            alert("Format QR Salah!");
            sudahScan = false;
            return;
        }

        if (Date.now() > dataQR.expired) {
            alert("QR Sudah Expired!");
            sudahScan = false;
            return;
        }

        let pertemuan = dataQR.pertemuan;
        let nama = localStorage.getItem("nama");
        let nim = localStorage.getItem("nim");
        let waktu = new Date().toLocaleString();

        document.getElementById("hasil").innerHTML =
        `
        Nama : ${nama}<br>
        NIM : ${nim}<br>
        Pertemuan : ${pertemuan}<br>
        Jam : ${waktu}
        `;

        fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({
                nama: nama,
                nim: nim,
                pertemuan: pertemuan,
                waktu: waktu
            })
        })
        .then(res => res.text())
        .then(data => {
            console.log(data);
            alert("Absensi Berhasil!");

            localStorage.removeItem("nama");
            localStorage.removeItem("nim");

            window.location.href = "index.html";
        })
        .catch(err => {
            console.error(err);
            alert("Gagal mengirim data!");
            sudahScan = false;
        });
    }

    const scanner = new Html5QrcodeScanner(
        "reader",
        {
            fps: 10,
            qrbox: 250
        }
    );

    scanner.render(onScanSuccess);
}


// ==========================================
// 2. LOGIKA ADMIN
// ==========================================

function loginAdmin(){
    let user = document.getElementById("username").value.trim();
    let pass = document.getElementById("password").value.trim();

    if(user === "OctavaCenturia104" && pass === "Viky270905"){
        localStorage.setItem("admin", "true");
        window.location.href = "admin.html";
    }else{
        alert("Username atau Password Salah");
    }
}

function buatQR(){
    let pertemuan = document.getElementById("pertemuan").value.trim();

    if(pertemuan === ""){
        alert("Isi nama pertemuan terlebih dahulu!");
        return;
    }

    let expired = Date.now() + (15 * 60 * 1000); // 15 Menit

    let dataQR = {
        pertemuan : pertemuan,
        expired : expired
    };

    let isiQR = JSON.stringify(dataQR);

    localStorage.setItem("qrAktif", isiQR);

    document.getElementById("qrcode").innerHTML = "";

    new QRCode(
        document.getElementById("qrcode"),
        isiQR
    );

    clearInterval(intervalTimer);

    intervalTimer = setInterval(() => {
        let sisa = Math.floor((expired - Date.now()) / 1000);

        if(sisa <= 0){
            clearInterval(intervalTimer);
            document.getElementById("timer").innerHTML = "QR Expired";
            localStorage.removeItem("qrAktif");
            document.getElementById("qrcode").innerHTML = "";
            return;
        }

        let menit = Math.floor(sisa / 60);
        let detik = sisa % 60;

        document.getElementById("timer").innerHTML =
        `Expired dalam ${menit}:${detik.toString().padStart(2,'0')}`;

    }, 1000);
}

function logoutAdmin(){
    localStorage.removeItem("admin");
    window.location.href = "admin-login.html";
}


// ==========================================
// 3. LOGIKA KAS KELAS
// ==========================================

let selectedKasData = null;

function cekTunggakanKas() {
    let nama = document.getElementById("kas_nama").value.trim();
    let nim = document.getElementById("kas_nim").value.trim();
    let msg = document.getElementById("msg_kas");
    let area = document.getElementById("area_tunggakan");

    if (nama === "" || nim === "") {
        alert("Nama dan NIM wajib diisi!");
        return;
    }

    msg.innerText = "⏳ Memeriksa tunggakan...";
    area.style.display = "none";

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "getTunggakanKas",
            nim: nim
        })
    })
    .then(res => res.json())
    .then(res => {
        if (!res.success || res.tunggakan.length === 0) {
            msg.innerText = "🎉 Kamu tidak memiliki tunggakan kas (Semua Bulan Lunas)!";
            return;
        }

        msg.innerText = "";
        let listContainer = document.getElementById("list_bulan");
        listContainer.innerHTML = "";

        let t = res.tunggakan[0];
        listContainer.innerHTML = `
            <div style="background: #eef5ff; padding: 10px; border-left: 4px solid #007bff; margin-bottom: 10px;">
                <p style="margin: 3px 0;"><b>Bulan:</b> ${t.bulan}</p>
                <p style="margin: 3px 0;"><b>Kas:</b> Rp${t.kas.toLocaleString('id-ID')}</p>
                <p style="margin: 3px 0;"><b>Denda Telat:</b> Rp${t.denda.toLocaleString('id-ID')}</p>
            </div>
        `;

        document.getElementById("total_bayar_text").innerText = `Rp${t.total.toLocaleString('id-ID')}`;
        selectedKasData = {
            nama: nama,
            nim: nim,
            bulan: t.bulan,
            kas: t.kas,
            denda: t.denda,
            total: t.total,
            metode: "Online"
        };

        area.style.display = "block";
    })
    .catch(err => {
        console.error(err);
        msg.innerText = "❌ Gagal memuat data kas.";
    });
}

function submitBayarKas() {
    if (!selectedKasData) return;

    if (!confirm(`Konfirmasi pembayaran kas bulan ${selectedKasData.bulan} sebesar Rp${selectedKasData.total.toLocaleString('id-ID')}?`)) {
        return;
    }

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "submitKas",
            ...selectedKasData
        })
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message || "Pembayaran Kas Berhasil!");
        window.location.href = "index.html";
    })
    .catch(err => {
        console.error(err);
        alert("Gagal menyimpan pembayaran!");
    });
}