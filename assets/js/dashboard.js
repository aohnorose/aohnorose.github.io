document.addEventListener('DOMContentLoaded', function () {
    const typeSelect = document.getElementById('typeSelect');
    const fileSelect = document.getElementById('fileSelect');
    const loadBtn = document.getElementById('loadBtn');
    const dataDisplay = document.getElementById('dataDisplay');
    const statusDiv = document.getElementById('status');
    const summaryDiv = document.getElementById('summary');

    // Chart instances
    let monthlyChart = null;
    let observedChart = null;

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

    typeSelect.addEventListener('change', () => {
        // Sync local trend selector if it exists
        const trendTypeSelect = document.getElementById('trendTypeSelect');
        if (trendTypeSelect && trendTypeSelect.value !== typeSelect.value) {
            trendTypeSelect.value = typeSelect.value;
        }

        populateFileSelect();
        // Also refresh charts if they are visible
        // We check display style to avoid unnecessary fetches, 
        // but simple app might just fetch.
        // The original code was:
        loadMonthlyTrend();
        loadObservedTrend();
    });

    // Tab buttons event listeners (added in HTML onclick, but we hook here to load data)
    window.openTab = function (evt, tabName) {
        var i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tab-content");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        tablinks = document.getElementsByClassName("tab-btn");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";

        if (tabName === 'MonthlyTrend') loadMonthlyTrend();
        if (tabName === 'ObservedTrend') loadObservedTrend();
    }

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

    // --- Chart Functions ---

    // Cached stats data to avoid re-fetching on region change
    let currentStatsData = null;
    const trendRegionSelect = document.getElementById('trendRegionSelect');
    const trendTypeSelect = document.getElementById('trendTypeSelect');

    trendRegionSelect.addEventListener('change', () => {
        if (currentStatsData) renderMonthlyChart(currentStatsData);
    });

    if (trendTypeSelect) {
        trendTypeSelect.addEventListener('change', () => {
            if (typeSelect.value !== trendTypeSelect.value) {
                typeSelect.value = trendTypeSelect.value;
                typeSelect.dispatchEvent(new Event('change'));
            }
        });
        // Initialize
        trendTypeSelect.value = typeSelect.value;
    }

    function loadMonthlyTrend() {
        const type = typeSelect.value;
        const url = `assets/data/stats_${type}.json`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                currentStatsData = data;
                populateRegionSelect(data);
                renderMonthlyChart(data);
            })
            .catch(err => console.log("No stats found or error:", err));
    }

    function populateRegionSelect(data) {
        // Only populate if it has only "Total"
        if (trendRegionSelect.options.length > 1) return;

        // Get keys (months) from data e.g., "2024_11", "2024_12"
        const months = Object.keys(data);
        if (months.length === 0) return;

        // Collect all unique region keys from ALL months
        const allRegions = new Set();
        months.forEach(m => {
            const monthData = data[m];
            Object.keys(monthData).forEach(k => {
                if (k !== 'total') {
                    allRegions.add(k);
                }
            });
        });

        // Convert to array and sort
        const guNames = Array.from(allRegions).sort();

        guNames.forEach(gu => {
            const option = document.createElement('option');
            option.value = gu;
            option.text = gu;
            trendRegionSelect.add(option);
        });
    }

    function renderMonthlyChart(data) {
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        if (monthlyChart) monthlyChart.destroy();

        const selectedRegion = trendRegionSelect.value; // "Total" or Gu name

        // data format: { "2025_11": {"total": 100, "종로구": 10}, "2025_12": ... }
        // Sort keys (Year_Month) naturally
        const months = Object.keys(data).sort();

        let chartData;
        let chartLabel;

        if (months.length === 0) return;

        if (selectedRegion === "Total") {
            // 'total' key from python script
            chartData = months.map(m => data[m]['total'] || 0);
            chartLabel = `Total Transactions (Seoul Total, ${typeSelect.value})`;
        } else {
            chartData = months.map(m => data[m][selectedRegion] || 0);
            chartLabel = `Transactions (${selectedRegion}, ${typeSelect.value})`;
        }

        monthlyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months, // e.g. "2025_11", "2025_12"
                datasets: [{
                    label: chartLabel,
                    data: chartData,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }


    function loadObservedTrend() {
        const type = typeSelect.value;
        const url = `assets/data/observation_log_${type}.json`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                renderObservedChart(data);
            })
            .catch(err => console.log("No observation log found or error:", err));
    }

    function renderObservedChart(data) {
        const ctx = document.getElementById('observedChart').getContext('2d');
        if (observedChart) observedChart.destroy();

        // data format: [ { "observation_date": "...", "data": { "11": 100, "10": 90 } }, ... ]
        // We want to track the latest "target month" found in the logs.
        // Actually, the user wants to see how a specific month's data changed over time.
        // Let's visualize the "Current Month" from the logs.

        const labels = data.map(entry => entry.observation_date);

        // Extract the counts for the month that was "current" at the time of logging
        // Or better, let's pick the most recent target month from the last log entry and trace THAT back?
        // Simpler approach for now: Plot the "Current Month" count as recorded in that entry. 
        // Note that "Current Month" changes over time. 
        // Alternatively, if the log contains multiple keys, we can plot multiple lines.

        // Let's try to plot all unique target months found in the last entry
        if (data.length === 0) return;

        const lastEntry = data[data.length - 1];
        const targetMonths = Object.keys(lastEntry.data); // e.g. ["11", "10"]

        const datasets = targetMonths.map((tm, index) => {
            // Random color
            const color = `hsl(${index * 137.5}, 70%, 50%)`;

            return {
                label: `Month ${tm} Count`,
                data: data.map(entry => entry.data[tm] || null), // null if not present
                borderColor: color,
                tension: 0.1
            };
        });

        observedChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true
            }
        });
    }
});
