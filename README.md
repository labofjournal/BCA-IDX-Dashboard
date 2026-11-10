# BCA IDX — Sales Dashboard

Dashboard penjualan simulasi bergaya *sales console* untuk BCA IDX. Seluruh
antarmuka dan data dihasilkan sepenuhnya di peramban (browser) — tanpa server,
tanpa dependensi, cukup satu file `index.html`.

> **URL:**  🔗 <https://labofjournal.github.io/BCA-IDX-Dashboard/>

---

## Tentang Proyek

BCA IDX Sales Dashboard menampilkan simulasi aktivitas penjualan harian
(kanal **Online** dan **Toko Fisik**) dalam tampilan dashboard gelap bergaya
editorial. Semua angka merupakan **data simulasi** yang dibangkitkan oleh
PRNG berbasis seed (`mulberry32`), sehingga bentuk data tetap konsisten per
periode namun tetap berbeda di setiap sesi. Tidak ada data pribadi maupun
data riil yang dikumpulkan atau dikirim ke mana pun.

## Fitur Utama

- **Pendapatan Harian** — grafik SVG buatan sendiri (tanpa library) dengan
  dua seri (Online / Toko Fisik) plus garis rata-rata, tooltip *hover*, dan
  animasi angka *hero* (pendapatan hari ini, pesanan, transaksi sesi,
  puncak harian).
- **Periode 7H / 30H / 90H** — sakelar periode untuk mengganti rentang data.
- **Ringkasan Periode** — KPI pendapatan, total pesanan, nilai per
  transaksi (AOV), dan tingkat konversi, lengkap dengan *sparkline* serta
  chip perubahan naik/turun.
- **Produk Terlaris** — peringkat produk teratas pada periode terpilih.
- **Wilayah** — distribusi penjualan per wilayah.
- **Transaksi Langsung** — *feed* transaksi yang mengalir real-time, dapat
  dijeda/lanjut lewat tombol pause.
- **Ekspor CSV / XLSX** — tombol *Download (CSV/XLSX)*:
  - **CSV** — pemisah `;`, UTF-8 + BOM, CRLF, angka uang murni — aman
    langsung dibuka di Excel locale Indonesia.
  - **XLSX** — workbook `.xlsx` asli berisi 5 sheet terpisah (lengkap dengan
    CRC32, ZIP STORE, dan XML worksheet yang dibangun manual di JavaScript,
    termasuk chart native Excel).
- **Jam & ticker** — jam real-time di header dan *ticker* berjalan di bawahnya.

## Tumpukan Teknologi

| Lapisan  | Teknologi                                        |
| -------- | ------------------------------------------------ |
| Markup   | HTML5 (satu halaman, `lang="id"`)                |
| Gaya     | CSS murni (`src/styles.css`), font Google Fonts  |
| Logika   | JavaScript vanilla (ES2020), tanpa framework     |
| Grafik   | SVG yang dirender manual lewat DOM               |
| Ekspor   | Blob + data URI (CSV) dan ZIP/XML buatan sendiri (XLSX) |

## Menjalankan Secara Lokal

Tidak ada proses *build*. Cukup salah satu dari:

```bash
# Opsi 1 — buka langsung
buka index.html di peramban (klik dua kali file-nya)

# Opsi 2 — lewat server statis (disarankan)
python3 -m http.server 8000
# lalu akses http://localhost:8000
```

## Struktur Proyek

```
BCA-IDX-Dashboard-main/
├── index.html          # Halaman utama dashboard
├── README.md           # Dokumen ini
├── logo/
│   └── icon_web.svg    # Logo & favicon
└── src/
    ├── styles.css      # Seluruh gaya tampilan
    └── app/
        ├── main.js         # State, PRNG simulasi, render chart & UI
        ├── build-csv.js    # Modul ekspor CSV (Excel-ID friendly)
        └── build-excel.js  # Modul ekspor XLSX (ZIP + XML manual)
```

## Catatan

- Semua angka, nama produk, dan wilayah adalah **simulasi** — ditujukan
  untuk demo/prototipe antarmuka, bukan laporan keuangan yang sebenarnya.
- Ekspor mengikuti nama file otomatis berformat `dd-mm-yy_hh-mm-ss`.
- Seluruh pemrosesan (simulasi, render, hingga pembuatan file ekspor)
  terjadi lokal di peramban Anda.
