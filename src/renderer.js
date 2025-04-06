class CoreWarsRenderer {
    constructor() {
        this.canvas = document.getElementById('coreWarsCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size to fit on most screens while showing all cells
        this.canvas.width = 1280;  // Increased width
        this.canvas.height = 800;  // Increased height
        
        // Grid configuration
        this.memorySize = 8192;    // Total memory cells
        this.gridWidth = 128;      // More columns for better aspect ratio
        this.gridHeight = 64;      // 128 x 64 = 8192 cells
        
        // Calculate cell size based on canvas dimensions
        this.cellSize = Math.min(
            Math.floor(this.canvas.width / this.gridWidth),
            Math.floor(this.canvas.height / this.gridHeight)
        );
        
        // Calculate grid offset to center it
        this.offsetX = (this.canvas.width - (this.cellSize * this.gridWidth)) / 2;
        this.offsetY = (this.canvas.height - (this.cellSize * this.gridHeight)) / 2;

        // Terminal theme colors
        this.terminalGreen = '#00ff00';  // Bright terminal green
        this.dimGreen = '#004400';       // Darker green for grid
        
        // Warrior colors (using CSS hex format)
        this.colors = {
            1: '#ff0000', // Red - Imp
            2: '#0000ff', // Blue - Dwarf
            3: '#00ff00', // Green - Splasher
            4: '#ff00ff', // Magenta - Pointer Killer
            5: '#00ffff', // Cyan - Hydra
            6: '#ffa500', // Orange - Reaper
            7: '#ffff00', // Yellow - Imp2
            8: '#ff1493'  // Deep Pink - Painter
        };

        // Bind event handlers
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        
        // Store callback for click handling
        this.onCellClick = null;
    }

    clear() {
        // Clear with black background
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid() {
        // Draw black background
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid lines with dim terminal green
        this.ctx.strokeStyle = this.dimGreen;
        this.ctx.lineWidth = 0.5;

        // Draw vertical lines
        for (let x = 0; x <= this.gridWidth; x++) {
            const xPos = this.offsetX + (x * this.cellSize);
            this.ctx.beginPath();
            this.ctx.moveTo(xPos, this.offsetY);
            this.ctx.lineTo(xPos, this.offsetY + (this.cellSize * this.gridHeight));
            this.ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= this.gridHeight; y++) {
            const yPos = this.offsetY + (y * this.cellSize);
            this.ctx.beginPath();
            this.ctx.moveTo(this.offsetX, yPos);
            this.ctx.lineTo(this.offsetX + (this.cellSize * this.gridWidth), yPos);
            this.ctx.stroke();
        }
    }

    drawCell(index, instruction) {
        const x = index % this.gridWidth;
        const y = Math.floor(index / this.gridWidth);
        
        const pixelX = this.offsetX + (x * this.cellSize);
        const pixelY = this.offsetY + (y * this.cellSize);

        // Fill cell based on ownership with a glow effect
        if (instruction && instruction.ownerId !== null) {
            const color = this.colors[instruction.ownerId] || this.terminalGreen;
            
            // Create a subtle glow effect
            const gradient = this.ctx.createRadialGradient(
                pixelX + this.cellSize/2, pixelY + this.cellSize/2, 0,
                pixelX + this.cellSize/2, pixelY + this.cellSize/2, this.cellSize
            );
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(
                pixelX, 
                pixelY, 
                this.cellSize, 
                this.cellSize
            );
            
            // Draw cell content
            this.ctx.fillStyle = color;
            this.ctx.fillRect(
                pixelX + 1, 
                pixelY + 1, 
                this.cellSize - 2, 
                this.cellSize - 2
            );
        }
    }

    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        // Convert click coordinates to grid position
        const gridX = Math.floor((clickX - this.offsetX) / this.cellSize);
        const gridY = Math.floor((clickY - this.offsetY) / this.cellSize);

        // Check if click is within grid bounds
        if (gridX >= 0 && gridX < this.gridWidth && 
            gridY >= 0 && gridY < this.gridHeight) {
            const index = gridY * this.gridWidth + gridX;
            
            if (this.onCellClick) {
                this.onCellClick(index, event.clientX, event.clientY);
            }
        }
    }

    setClickHandler(callback) {
        this.onCellClick = callback;
    }

    getCellPosition(index) {
        const x = index % this.gridWidth;
        const y = Math.floor(index / this.gridWidth);
        
        return {
            x: this.offsetX + (x * this.cellSize),
            y: this.offsetY + (y * this.cellSize)
        };
    }
} 