// server.js
const express = require('express');
const net     = require('net');

const app       = express();
const PRINTER_IP   = process.env.PRINTER_IP || '173.16.52.156';  // Use environment variable
const PRINTER_PORT = process.env.PRINTER_PORT || 9100;

app.use(express.json());

// Serve the HTML + client-side JS
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Label Printer</title>
      <style>
        body { font-family: sans-serif; padding: 2rem; }
        input, button { font-size: 1rem; padding: 0.5rem; }
        #status { margin-top: 1rem; }
      </style>
    </head>
    <body>
      <h1>Print Barcode Label</h1>
      <label>
        Serial:
        <input id="serial" type="text" value="SN-0012345678" />
      </label>
      <button id="printBtn">Print</button>
      <div id="status"></div>

      <script>
        const btn    = document.getElementById('printBtn');
        const input  = document.getElementById('serial');
        const status = document.getElementById('status');

        btn.addEventListener('click', async () => {
          const serial = input.value.trim();
          if (!serial) {
            status.textContent = 'Enter a serial first.';
            return;
          }
          status.textContent = 'Printing…';
          try {
            const res = await fetch('/print', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ serial })
            });
            const json = await res.json();
            if (json.success) {
              status.textContent = '✅ Printed successfully!';
            } else {
              status.textContent = '❌ Printer error: ' + json.error;
            }
          } catch (err) {
            status.textContent = '❌ Network error: ' + err.message;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// API to send TSPL to the printer
app.post('/print', (req, res) => {
  const { serial } = req.body;
  if (!serial) {
    return res.status(400).json({ error: 'serial is required' });
  }

  // Build your TSPL commands
  const tspl = `
SIZE 60 mm,40 mm
GAP 2 mm,0
CLS
BARCODE 20,20,"128",50,1,0,2,2,"${serial}"
TEXT 20,80,"3",0,1,1,"${serial}"
PRINT 1
`.trim();

  const client = new net.Socket();
  let responded = false;

  client.on('error', err => {
    if (!responded) {
      responded = true;
      res.status(500).json({ error: err.message });
    }
  });

  client.connect(PRINTER_PORT, PRINTER_IP, () => {
    client.write(tspl, 'ascii', () => {
      client.end();
      if (!responded) {
        responded = true;
        res.json({ success: true });
      }
    });
  });
});

// Export the Express API
module.exports = app;

