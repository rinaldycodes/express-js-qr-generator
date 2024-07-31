const express = require('express');
const path = require('path')

const QRCode = require('qrcode');
const Jimp = require('jimp');
const axios = require('axios');

const app = express();

const port = parseInt(process.env.PORT) || process.argv[3] || 8080;

app.use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.render('index');
});

// Fungsi untuk memvalidasi warna hex
const isValidHexColor = (color) => /^#[0-9A-Fa-f]{6}$/.test(color);

app.get('/generateQR', async (req, res) => {
  try {
    const url = req.query.url || 'https://example.com';
    let logoUrl = req.query.logoUrl; // URL logo yang akan ditempelkan di QR Code (opsional)
    let color = decodeURIComponent(req.query.color) || '#000000'; // Warna kustom QR Code
    const width = parseInt(req.query.width, 10) || 300; // Lebar QR Code
    const height = parseInt(req.query.height, 10) || width; // Tinggi QR Code, default sama dengan lebar

    // Log parameter yang diterima
    console.log('Received color:', color);
    console.log('Received width:', width);
    console.log('Received height:', height);

    // Validasi warna hex
    if (!isValidHexColor(color)) {
      console.error('Invalid color format received:', color);
      return res.status(400).send('Invalid hex color format. Use #RRGGBB.');
    }

    // Buat QR Code dengan warna kustom
    const qrCodeBuffer = await QRCode.toBuffer(url, {
      color: { dark: color, light: '#FFFFFF' },
      width: Math.min(width, 1000), // Maksimal lebar QR Code untuk menghindari error
    });

    // Baca QR Code ke dalam Jimp image
    const qrImage = await Jimp.read(qrCodeBuffer);

    // Resize QR Code image ke dimensi yang diinginkan
    qrImage.resize(width, height);

    // Jika ada logo URL, tambahkan logo ke QR Code
    if (logoUrl) {
      try {
        // Ambil logo
        const { data, headers } = await axios({
          url: logoUrl,
          responseType: 'arraybuffer'
        });

        // Periksa jenis konten
        if (!headers['content-type'].startsWith('image/')) {
          throw new Error('Invalid image content type');
        }

        const logo = await Jimp.read(Buffer.from(data));
        const qrWidth = qrImage.bitmap.width;
        const logoWidth = qrWidth / 4; // Ukuran logo (misalnya, 1/4 dari lebar QR Code)
        logo.resize(logoWidth, Jimp.AUTO); // Sesuaikan ukuran logo
        const x = (qrWidth - logo.bitmap.width) / 2;
        const y = (qrWidth - logo.bitmap.height) / 2;
        qrImage.composite(logo, x, y, {
          mode: Jimp.BLEND_SOURCE_OVER,
          opacitySource: 1,
          opacityDest: 1
        }); // Tempelkan logo di tengah QR Code

        console.log('Logo successfully added to QR code.');
      } catch (err) {
        console.error('Error fetching or processing logo:', err.message);
        return res.status(400).send(`Invalid logo URL or logo cannot be processed: ${err.message}`);
      }
    }

    // Convert Jimp image ke buffer
    const qrBuffer = await qrImage.getBufferAsync(Jimp.MIME_PNG);

    // Kirimkan gambar QR Code sebagai respons
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': qrBuffer.length,
    });
    res.end(qrBuffer);
  } catch (err) {
    console.error('Error generating QR code:', err.message);
    res.status(500).send('Internal Server Error: '+ err.message);
  }
});

app.get('/api', (req, res) => {
  res.json({"msg": "Hello world"});
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
})
