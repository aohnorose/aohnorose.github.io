document.addEventListener('DOMContentLoaded', function () {
    const typeSelect = document.getElementById('typeSelect');
    const fileSelect = document.getElementById('fileSelect');
    const loadBtn = document.getElementById('loadBtn');
    const dataDisplay = document.getElementById('dataDisplay');
    const statusDiv = document.getElementById('status');
    const summaryDiv = document.getElementById('summary');

    let manifest = { trade: [], rent: [] };

    // Fetch manifest
    fetch('assets/data/manifest.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("Manifest not found. Please run the python scripts first.");
            }
            return response.json();
        })
        .then(data => {
            manifest = data;
            populateFileSelect();
        })
        .catch(err => {
            console.error(err);
            statusDiv.textContent = "Error loading manifest: " + err.message;
        });

    typeSelect.addEventListener('change', populateFileSelect);

    function populateFileSelect() {
        const type = typeSelect.value; // 'trade' or 'rent'
        const files = manifest[type] || [];

        fileSelect.innerHTML = '';
        if (files.length === 0) {
            const option = document.createElement('option');
            option.text = "No files found";
            fileSelect.add(option);
            fileSelect.disabled = true;
            loadBtn.disabled = true;
        } else {
            files.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.text = file;
                fileSelect.add(option);
            });
            fileSelect.disabled = false;
            loadBtn.disabled = false;
        }
    }

    loadBtn.addEventListener('click', function () {
        const type = typeSelect.value;
        const file = fileSelect.value;
        if (!file) return;

        const url = `assets/data/${type}/${file}`;
        statusDiv.textContent = `Loading ${file}...`;
        dataDisplay.innerHTML = '';
        summaryDiv.innerHTML = '';

        Papa.parse(url, {
            download: true,
            header: true,
            dynamicTyping: true,
            complete: function (results) {
                statusDiv.textContent = `Loaded ${results.data.length} records.`;
                renderTable(results.data);
                renderSummary(results.data);
            },
            error: function (err) {
                statusDiv.textContent = "Error parsing CSV: " + err.message;
            }
        });
    });

    function renderTable(data) {
        if (data.length === 0) return;

        // Get headers from first row
        const headers = Object.keys(data[0]);
        // Filter out empty rows or strange columns if needed

        let html = '<div style="overflow-x:auto;"><table><thead><tr>';
        headers.forEach(h => {
            // Exclude weird "index" or unnamed columns if they exist
            if (h && h.trim() !== '') {
                html += `<th>${h}</th>`;
            }
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            headers.forEach(h => {
                if (h && h.trim() !== '') {
                    html += `<td>${row[h] !== undefined ? row[h] : ''}</td>`;
                }
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        dataDisplay.innerHTML = html;
    }

    function renderSummary(data) {
        // Simple summary: Total count, Average amount (if available)
        // Adjust field names based on actual CSV headers. 
        // Based on script: '거래금액' (dealAmount)

        let totalAmount = 0;
        let count = 0;

        data.forEach(row => {
            if (row['거래금액']) {
                // Ensure it's a number (script saves it as int or string with commas removed)
                const val = Number(row['거래금액']);
                if (!isNaN(val)) {
                    totalAmount += val;
                    count++;
                }
            }
        });

        let summaryHtml = `<p><strong>Total Records:</strong> ${data.length}</p>`;
        if (count > 0) {
            const avg = (totalAmount / count).toLocaleString(undefined, { maximumFractionDigits: 0 });
            summaryHtml += `<p><strong>Average Deal Amount:</strong> ${avg} (unit)</p>`;
        }
        summaryDiv.innerHTML = summaryHtml;
    }
});
