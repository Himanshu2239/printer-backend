const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3001; // You can change the port

// Update with your printer share name
const PRINTER_SHARE = process.env.PRINTER_SHARE || 'TSC TTP-644MT';
const TEMP_DIR = 'C:\\print_temp'; // Make sure this folder exists

// Create temp directory if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) {
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`Created temp directory at ${TEMP_DIR}`);
  } catch (err) {
    console.error(`Error creating temp directory: ${err.message}`);
  }
}

app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

// Serve HTML UI
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
      <h1>Print Barcode Label (USB)</h1>
      <label>
        Serial:
        <input id="serial" type="text" value="SN-0012345678" />
      </label>
      <button id="printBtn">Print</button>
      <div id="status"></div>

      <script>
        const btn = document.getElementById('printBtn');
        const input = document.getElementById('serial');
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
            
            if (!res.ok) {
              throw new Error('HTTP error! status: ' + res.status);
            }
            
            const json = await res.json();
            if (json.success) {
              status.textContent = '✅ Printed successfully!';
            } else {
              status.textContent = '❌ Printer error: ' + json.error;
            }
          } catch (err) {
            console.error('Print error:', err);
            status.textContent = '❌ Error: ' + err.message;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Print route using COPY command to USB printer
app.post('/print', async (req, res) => {
  try {
    const { serial } = req.body;
    if (!serial) {
      return res.status(400).json({ error: 'serial is required' });
    }

    // TSPL2 commands
    const tspl2 = `
SIZE 60 mm,40 mm
GAP 2 mm,0
DIRECTION 0
CLS
CODEPAGE UTF-8
TEXT 20,20,"3",0,1,1,"${serial}"
BARCODE 20,50,"128",50,1,0,2,2,"${serial}"
PRINT 1
`.trim();

    // Create TSPL2 file
    const filename = `label_${Date.now()}.prn`;
    const filePath = path.join(TEMP_DIR, filename);

    // Write file
    fs.writeFileSync(filePath, tspl2, 'ascii');

    // Use COPY to send it to printer
    const copyCmd = `COPY /B "${filePath}" \\\\localhost\\${PRINTER_SHARE}`;
    
    exec(copyCmd, (err, stdout, stderr) => {
      // Clean up the temp file
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupErr) {
        console.error('Error cleaning up temp file:', cleanupErr);
      }

      if (err) {
        console.error('Print error:', stderr || err.message);
        return res.status(500).json({ error: stderr || err.message });
      }
      return res.json({ success: true });
    });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`USB printer backend running at http://localhost:${PORT}`);
});
