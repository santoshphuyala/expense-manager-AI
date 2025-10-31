// OCR Receipt Scanner
class ReceiptScanner {
    constructor() {
        this.worker = null;
        this.initWorker();
    }

    async initWorker() {
        try {
            this.worker = await Tesseract.createWorker({
                logger: m => {
                    if (m.status === 'recognizing text') {
                        this.updateProgress(m.progress * 100);
                    }
                }
            });
            await this.worker.loadLanguage('eng');
            await this.worker.initialize('eng');
        } catch (error) {
            console.error('Failed to initialize OCR worker:', error);
        }
    }

    updateProgress(percent) {
        const statusEl = document.getElementById('scannerStatus');
        if (statusEl) {
            statusEl.innerHTML = `
                <div class="status-icon">⏳</div>
                <p>Scanning receipt... ${Math.round(percent)}%</p>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percent}%"></div>
                </div>
            `;
        }
    }

    async scanReceipt(imageFile) {
        if (!this.worker) {
            await this.initWorker();
        }

        try {
            const { data: { text } } = await this.worker.recognize(imageFile);
            return this.parseReceiptText(text);
        } catch (error) {
            console.error('OCR Error:', error);
            throw new Error('Failed to scan receipt');
        }
    }

    parseReceiptText(text) {
        const lines = text.split('\n').filter(line => line.trim());
        
        // Extract data
        const data = {
            rawText: text,
            items: [],
            total: 0,
            date: null,
            store: null,
            tax: 0
        };

        // Try to find store name (usually first few lines)
        if (lines.length > 0) {
            data.store = lines[0].trim();
        }

        // Find date (common patterns)
        const datePatterns = [
            /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
            /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/,
            /(\d{1,2}\s+\w+\s+\d{4})/
        ];

        for (const line of lines) {
            for (const pattern of datePatterns) {
                const match = line.match(pattern);
                if (match) {
                    data.date = this.parseDate(match[1]);
                    break;
                }
            }
            if (data.date) break;
        }

        // Find total amount
        const totalPatterns = [
            /total[:\s]+[\$₹रू]?\s*(\d+\.?\d*)/i,
            /amount[:\s]+[\$₹रू]?\s*(\d+\.?\d*)/i,
            /grand\s+total[:\s]+[\$₹रू]?\s*(\d+\.?\d*)/i
        ];

        for (const line of lines) {
            for (const pattern of totalPatterns) {
                const match = line.match(pattern);
                if (match) {
                    data.total = parseFloat(match[1]);
                    break;
                }
            }
            if (data.total > 0) break;
        }

        // Find tax
        const taxPattern = /tax[:\s]+[\$₹रू]?\s*(\d+\.?\d*)/i;
        for (const line of lines) {
            const match = line.match(taxPattern);
            if (match) {
                data.tax = parseFloat(match[1]);
                break;
            }
        }

        // Extract items (lines with prices)
        const itemPattern = /^(.+?)\s+[\$₹रू]?\s*(\d+\.?\d*)$/;
        for (const line of lines) {
            const match = line.match(itemPattern);
            if (match) {
                const itemName = match[1].trim();
                const price = parseFloat(match[2]);
                
                // Skip if it looks like a total or tax line
                if (!/total|tax|subtotal|amount|balance/i.test(itemName) && price > 0) {
                    data.items.push({
                        name: itemName,
                        price: price
                    });
                }
            }
        }

        // If no items found but we have a total, create a generic item
        if (data.items.length === 0 && data.total > 0) {
            data.items.push({
                name: 'Receipt Items',
                price: data.total
            });
        }

        return data;
    }

    parseDate(dateString) {
        // Try to parse various date formats
        const formats = [
            // DD/MM/YYYY or DD-MM-YYYY
            /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/,
            // YYYY/MM/DD or YYYY-MM-DD
            /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/
        ];

        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                let year, month, day;
                
                if (match[1].length === 4) {
                    // YYYY-MM-DD format
                    year = match[1];
                    month = match[2].padStart(2, '0');
                    day = match[3].padStart(2, '0');
                } else {
                    // DD-MM-YYYY format
                    day = match[1].padStart(2, '0');
                    month = match[2].padStart(2, '0');
                    year = match[3].length === 2 ? '20' + match[3] : match[3];
                }
                
                return `${year}-${month}-${day}`;
            }
        }

        // Fallback to today's date
        return new Date().toISOString().split('T')[0];
    }

    async terminate() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}