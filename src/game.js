import { warriors } from './warriors.js';
import { Instruction, Opcode, AddressingMode } from './machine.js';

// Core Wars specific constants
const MEMORY_SIZE = 8192; // Standard MARS size
const CELL_SIZE = 10;    // Size of each memory cell visual representation
const MEMORY_COLS = 128;  // Fixed number of columns for 8192 cells
const MEMORY_ROWS = 64;   // 128 x 64 = 8192 cells

// Adjust canvas height to fit memory exactly
// app.renderer.resize(app.screen.width, MEMORY_ROWS * CELL_SIZE);

// --- UI Elements ---
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const resetButton = document.getElementById('resetButton');
const speedSlider = document.getElementById('speedSlider');
const speedValueSpan = document.getElementById('speedValue');
const tooltipElement = document.getElementById('tooltip');



// --- Core Representation ---
// Memory stores Instruction objects or null
const memory = new Array(MEMORY_SIZE).fill(null);


// Add a map to track warrior participation
let warriorParticipation = new Map(warriors.map(w => [w.id, true])); // All warriors start as active

// --- Loading Warriors ---
function loadWarrior(warrior, startAddress) {
    warrior.code.forEach((instr, i) => {
        const address = (startAddress + i) % MEMORY_SIZE;
        // Assign ownerId when loading
        memory[address] = new Instruction(
            instr.opcode,
            instr.aMode, instr.aValue,
            instr.bMode, instr.bValue,
            warrior.id
        );
        console.log(`Loading ${warrior.name} instruction ${i} at ${address}: ${memory[address]}`);
    });
}

// --- MARS Execution Engine ---
let processQueue = []; // Array to hold { warriorId, ip (instruction pointer) } objects
let currentProcessIndex = 0;
let cyclesPerTick = parseInt(speedSlider.value, 10); // Read initial value from slider
let gameOver = false;
let gameInterval = null; // Store interval ID
let isPaused = false;

function initializeProcesses() {
    processQueue = [];
    warriors.forEach(warrior => {
        // Find the start address (first instruction) loaded for this warrior
        const startAddress = memory.findIndex(instr => instr && instr.ownerId === warrior.id);
        if (startAddress !== -1) {
            processQueue.push({ warriorId: warrior.id, ip: startAddress });
            console.log(`Initialized process for ${warrior.name} (ID: ${warrior.id}) at IP: ${startAddress}`);
        } else {
            console.error(`Could not find starting instruction for warrior ${warrior.name}`);
        }
    });
    currentProcessIndex = 0; // Start with the first process
    gameOver = false;
}

function clearMemory() {
    for(let i = 0; i < MEMORY_SIZE; i++) {
        memory[i] = null;
    }
}

function resetGame() {
    console.log("--- Resetting Game ---");
    // Stop existing game loop
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }

    // Clear memory
    clearMemory();

    // Load warriors at staggered positions
    const baseSpacing = Math.floor(MEMORY_SIZE / warriors.length);
    warriors.forEach((warrior, index) => {
        // Add some randomness to the spacing while maintaining minimum distance
        const offset = Math.floor(baseSpacing * 0.2); // 20% of base spacing for randomness
        const randomOffset = Math.floor(Math.random() * offset * 2) - offset; // Random offset between -offset and +offset
        const startAddress = ((index * baseSpacing) + randomOffset + MEMORY_SIZE) % MEMORY_SIZE;
        
        // Ensure Painter starts with more space
        const adjustedAddress = warrior.name === 'Painter' ? 
            (startAddress + Math.floor(baseSpacing * 0.3)) % MEMORY_SIZE : 
            startAddress;
        
        console.log(`Loading ${warrior.name} at position ${adjustedAddress}`);
        loadWarrior(warrior, adjustedAddress);
    });

    // Reinitialize processes
    initializeProcesses(); // Resets gameOver flag as well

    // Redraw initial state
    drawMemory();

    // Reset UI state
    isPaused = false;
    startButton.disabled = false;
    pauseButton.disabled = true;
    console.log("Game Reset Complete.");
}

function startGame() {
    if (gameInterval) return; // Already running
    console.log("--- Starting Game ---");
    isPaused = false;
    startButton.disabled = true;
    pauseButton.disabled = false;
    // Start the game loop
    const TICK_INTERVAL_MS = 50; // milliseconds per tick update -> ~20 ticks per second
    gameInterval = setInterval(gameTick, TICK_INTERVAL_MS);
}

function pauseGame() {
    if (!gameInterval) return; // Not running
    console.log("--- Pausing Game ---");
    isPaused = true;
    clearInterval(gameInterval);
    gameInterval = null;
    startButton.disabled = false;
    pauseButton.disabled = true;
}

// Function to calculate the effective address based on mode and value
function getEffectiveAddress(currentIp, mode, value) {
    let address;
    switch (mode) {
        case AddressingMode.DIRECT:
            address = (currentIp + value) % MEMORY_SIZE;
            break;
        case AddressingMode.INDIRECT:
            // 1. Calculate the intermediate address (like DIRECT)
            const intermediateAddress = (currentIp + value) % MEMORY_SIZE;
            // 2. Read the B-field value from the instruction at the intermediate address
            const intermediateInstruction = memory[intermediateAddress];
            const offset = intermediateInstruction ? intermediateInstruction.bValue : 0; // Default to 0 if cell is empty
            // 3. The final address is currentIp + offset from intermediate instruction's B-field
            address = (currentIp + offset) % MEMORY_SIZE;
             // console.log(`  INDIRECT: IP=${currentIp}, Val=${value} -> Intermed @${intermediateAddress} -> Offset=${offset} -> Final @${address}`);
            break;
        // IMMEDIATE mode doesn't yield an address for fetching/writing, handled in getOperandValue/executeInstruction.
        case AddressingMode.IMMEDIATE:
             console.warn(`Attempted to getEffectiveAddress with IMMEDIATE mode @ ${currentIp}`);
             // Cannot use immediate for a destination address typically. Return current IP? Error?
             return currentIp; // Or handle error appropriately
        default:
            console.warn(`Unsupported addressing mode for getEffectiveAddress: ${mode}`);
            address = (currentIp + value) % MEMORY_SIZE; // Fallback/default behavior?
            break;
    }
    // Ensure address is positive after modulo
    return (address + MEMORY_SIZE) % MEMORY_SIZE;
}

// Helper function to get the numeric value of an operand (A or B field)
function getOperandValue(processIp, mode, value) {
    switch (mode) {
        case AddressingMode.IMMEDIATE:
            return value; // The value is the operand itself
        case AddressingMode.DIRECT:
        case AddressingMode.INDIRECT: // Indirect also needs to read from the final effective address
            {
                const effectiveAddress = getEffectiveAddress(processIp, mode, value);
                const targetInstruction = memory[effectiveAddress];
                // Decide what value to return if the target is empty or DAT.
                // Standard: Treat DAT like any other instruction field access. Return B-field for ADD/SUB/etc.
                // What if cell is empty (null)? Return 0?
                return targetInstruction ? targetInstruction.bValue : 0; // Simplified: return B-value or 0 if empty
                // TODO: Refine this based on which field (A/B) is needed by the opcode
            }
        default:
            console.warn(`Unsupported addressing mode for getOperandValue: ${mode}`);
            return 0; // Default value?
    }
}

function executeInstruction(process) {
    const instruction = memory[process.ip];
    let advanceIp = true; // Assume we advance the IP unless it's a JMP etc.

    // If the cell is empty or warrior tries to execute non-owned DAT, it dies?
    // Standard Core Wars: Executing DAT kills the process.
    if (!instruction || instruction.opcode === Opcode.DAT) {
        console.log(`Process for Warrior ${process.warriorId} died at IP ${process.ip} (Executed DAT or empty cell)`);
        return { survived: false, advancedIp: false }; // Indicate process death
    }

    // Get owner for debugging/validation
    const owner = warriors.find(w => w.id === process.warriorId);
    // console.log(`Warrior ${owner?.name} (ID: ${process.warriorId}) executing at ${process.ip}: ${instruction}`);

    let sourceAddress, destinationAddress;
    let sourceInstruction, valueA, valueB, targetAddress, destInstruction;

    switch (instruction.opcode) {
        case Opcode.MOV:
            destinationAddress = getEffectiveAddress(process.ip, instruction.bMode, instruction.bValue);

            if (instruction.aMode === AddressingMode.IMMEDIATE) {
                // Source is the A-field itself. Create a DAT instruction with the value.
                // Crucially, the new DAT instruction has no owner initially.
                // The ownerId of the MOV instruction performing the move is NOT copied.
                sourceInstruction = new Instruction(Opcode.DAT, AddressingMode.IMMEDIATE, 0, AddressingMode.IMMEDIATE, instruction.aValue, null); // Per Redcode standard
            } else {
                sourceAddress = getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                const sourceContent = memory[sourceAddress];
                 if (sourceContent) {
                    // Copy the entire instruction object from source
                    sourceInstruction = new Instruction(
                        sourceContent.opcode,
                        sourceContent.aMode, sourceContent.aValue,
                        sourceContent.bMode, sourceContent.bValue,
                        sourceContent.ownerId // Preserve owner of the source data
                    );
                } else {
                     // Reading from an empty cell - treat as DAT #0, $0 with no owner
                     sourceInstruction = new Instruction(Opcode.DAT, AddressingMode.IMMEDIATE, 0, AddressingMode.IMMEDIATE, 0, null);
                 }
            }

            // Write the sourceInstruction to the destination
            // The ownerId of the *destination* instruction becomes the ID of the warrior whose process executed the MOV.
            sourceInstruction.ownerId = process.warriorId;
            memory[destinationAddress] = sourceInstruction;
            // console.log(`  MOV: Copied from ${sourceAddress !== undefined ? sourceAddress : ('#' + instruction.aValue)} to ${destinationAddress}. New instruction: ${sourceInstruction}`);
            break;

        case Opcode.ADD:
            // Get destination address (from B operand)
            destinationAddress = getEffectiveAddress(process.ip, instruction.bMode, instruction.bValue);
            destInstruction = memory[destinationAddress];

            if (destInstruction) {
                // Get the value specified by the A operand
                if (instruction.aMode === AddressingMode.IMMEDIATE) {
                    valueA = instruction.aValue;
                } else {
                    // Non-immediate A: Get value from effective address A, specifically the B-field (common interpretation)
                    const sourceAAddress = getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                    const sourceAInstr = memory[sourceAAddress];
                    valueA = sourceAInstr ? sourceAInstr.bValue : 0;
                }

                // Simple ADD: Add A-operand's value to the B-field of the destination instruction.
                valueB = destInstruction.bValue; // Get the original B-value from destination
                const resultB = (valueA + valueB);

                // Update only the B-field of the destination instruction
                memory[destinationAddress] = new Instruction(
                    destInstruction.opcode,
                    destInstruction.aMode, destInstruction.aValue, // Keep original A-field
                    destInstruction.bMode, (resultB % MEMORY_SIZE + MEMORY_SIZE) % MEMORY_SIZE, // Store result in B-field, wrap
                    process.warriorId // Destination instruction owned by current warrior
                 );
                // console.log(`  ADD @${process.ip}: Modifying B-field @${destinationAddress}. Adding A=${valueA} to Dest B=${valueB} -> New B=${(resultB % MEMORY_SIZE + MEMORY_SIZE) % MEMORY_SIZE}`);

            } else {
                // What to do if destination is empty? Treat as DAT #0, #0? Ignore?
                console.warn(`ADD targeting empty cell @ ${destinationAddress}. Operation skipped.`);
            }
            break;

        case Opcode.JMP:
            targetAddress = getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
            process.ip = targetAddress;
            advanceIp = false; // Do not perform the standard IP increment
            // console.log(`  JMP: Jumping to ${targetAddress}`);
            break;

        case Opcode.SPL:
            targetAddress = getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
            const newProcess = { warriorId: process.warriorId, ip: targetAddress };
            processQueue.push(newProcess); // Add the new process to the queue
            // The current process continues to ip+1 (advanceIp remains true)
            // console.log(`  SPL: New process for Warrior ${process.warriorId} created at ${targetAddress}. Queue length: ${processQueue.length}`);
            break;

        case Opcode.SUB:
             // Similar to ADD, but subtracts
            destinationAddress = getEffectiveAddress(process.ip, instruction.bMode, instruction.bValue);
            destInstruction = memory[destinationAddress];

            if (destInstruction) {
                // Get the value specified by the A operand
                if (instruction.aMode === AddressingMode.IMMEDIATE) {
                    valueA = instruction.aValue;
                } else {
                    const sourceAAddress = getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                    const sourceAInstr = memory[sourceAAddress];
                    valueA = sourceAInstr ? sourceAInstr.bValue : 0;
                }

                // SUB: Subtract A-operand's value from the B-field of the destination instruction.
                valueB = destInstruction.bValue;
                let resultB = (valueB - valueA);

                // Update only the B-field
                memory[destinationAddress] = new Instruction(
                    destInstruction.opcode,
                    destInstruction.aMode, destInstruction.aValue,
                    destInstruction.bMode, (resultB % MEMORY_SIZE + MEMORY_SIZE) % MEMORY_SIZE, // Wrap result
                    process.warriorId
                 );
                 // console.log(`  SUB @${process.ip}: Modifying B-field @${destinationAddress}. Subtracting A=${valueA} from Dest B=${valueB} -> New B=${(resultB % MEMORY_SIZE + MEMORY_SIZE) % MEMORY_SIZE}`);
            } else {
                console.warn(`SUB targeting empty cell @ ${destinationAddress}. Operation skipped.`);
            }
            break;

        case Opcode.JMZ: // Jump to A if B is zero
            destinationAddress = getEffectiveAddress(process.ip, instruction.bMode, instruction.bValue);
            destInstruction = memory[destinationAddress];
            valueB = destInstruction ? destInstruction.bValue : 0; // Get B-field value, or 0 if empty

            if (valueB === 0) {
                targetAddress = getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                process.ip = targetAddress;
                advanceIp = false; // IP handled by jump
                // console.log(`  JMZ @${process.ip}: B-field at ${destinationAddress} is zero. Jumping to ${targetAddress}`);
            } else {
                 // console.log(`  JMZ @${process.ip}: B-field at ${destinationAddress} is non-zero (${valueB}). No jump.`);
                 // IP advances normally (advanceIp remains true)
            }
            break;

        case Opcode.DJN: // Decrement B, Jump to A if B is non-zero
            destinationAddress = getEffectiveAddress(process.ip, instruction.bMode, instruction.bValue);
            destInstruction = memory[destinationAddress];

            if (destInstruction) {
                // Decrement the B-field of the destination instruction
                valueB = destInstruction.bValue;
                resultB = valueB - 1;
                const wrappedResultB = (resultB % MEMORY_SIZE + MEMORY_SIZE) % MEMORY_SIZE;

                memory[destinationAddress] = new Instruction(
                    destInstruction.opcode,
                    destInstruction.aMode, destInstruction.aValue,
                    destInstruction.bMode, wrappedResultB,
                    process.warriorId
                 );
                // console.log(`  DJN @${process.ip}: Decremented B-field @${destinationAddress} from ${valueB} to ${wrappedResultB}`);

                // Check if the *decremented* value is non-zero
                if (wrappedResultB !== 0) {
                    targetAddress = getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                    process.ip = targetAddress;
                    advanceIp = false; // IP handled by jump
                    // console.log(`    DJN: Result (${wrappedResultB}) is non-zero. Jumping to ${targetAddress}`);
                } else {
                    // console.log(`    DJN: Result is zero. No jump.`);
                     // IP advances normally
                }
            } else {
                console.warn(`DJN targeting empty cell @ ${destinationAddress}. Operation skipped.`);
                // IP advances normally
            }
            break;

        // TODO: Implement other opcodes...

        default:
            console.warn(`Unimplemented opcode: ${instruction.opcode} at IP ${process.ip}`);
            // Treat as NOP for now - just advance IP
            break;
    }

    // Return process status and whether IP was already handled
    return { survived: true, advancedIp: !advanceIp }; // survived=true, advancedIp=true means IP needs +1, false means JMP/etc handled it
}

function gameTick() {
    if (gameOver || processQueue.length === 0) {
        console.log("Game Over or No Processes Left.");
        // Find winner (last warrior standing)
        if (processQueue.length > 0) {
            // Since gameOver might be set when only one warrior is left, find that warrior
            const winner = warriors.find(w => w.id === processQueue[0].warriorId);
             console.log(`Winner: ${winner?.name || 'Unknown'}`);
        } else {
            console.log("No warriors survived.");
        }
        clearInterval(gameInterval);
        gameInterval = null;
        startButton.disabled = true; // Can't restart until reset
        pauseButton.disabled = true;
        return;
    }

    // Check if only one warrior (or zero) remains
    if (processQueue.length > 0) {
        const firstWarriorId = processQueue[0].warriorId;
        const allSame = processQueue.every(p => p.warriorId === firstWarriorId);
        if (allSame && warriors.length > 1) {
             // If all remaining processes belong to the same warrior, they win.
             gameOver = true;
        }
    }
     // Add a cycle limit condition (e.g., after 50000 cycles) - simple version
    // TODO: Implement a proper cycle counter
    // if (totalCycles > 50000) { 
    //    gameOver = true; 
    //    console.log("Max cycles reached - Draw");
    // }

    // Cycle through processes - Use the dynamically updated cyclesPerTick
    for (let i = 0; i < cyclesPerTick; i++) {
        if (processQueue.length === 0) break; // Stop if queue becomes empty mid-tick

        // Ensure index is valid after potential removals
        currentProcessIndex %= processQueue.length;

        const currentProcess = processQueue[currentProcessIndex];
        const initialIp = currentProcess.ip;

        // Log process state before execution
        // console.log(`  Executing: Warrior ${currentProcess.warriorId}, IP: ${initialIp}, Instruction: ${memory[initialIp]}`);

        const executionResult = executeInstruction(currentProcess); // Now returns { survived, advancedIp }

        if (!executionResult.survived) {
            // Remove dead process from queue
            // console.log(`    Process died. Removing from queue. Queue size: ${processQueue.length - 1}`);
            processQueue.splice(currentProcessIndex, 1);
            // Do not increment currentProcessIndex, as the next element shifts down
        } else {
            const ipHandledByInstruction = executionResult.advancedIp; // True if JMP handled IP
            let ipAdvancedHere = false;
            // If the process survived and IP wasn't handled by JMP etc., advance it
            if (!ipHandledByInstruction) { // If IP was NOT handled by instruction (e.g., MOV, ADD, SPL)...
                 currentProcess.ip = (currentProcess.ip + 1) % MEMORY_SIZE; // ...advance it here.
                 ipAdvancedHere = true;
            }
            // Log IP change
            // console.log(`    Survived. IP Handled By Instruction: ${ipHandledByInstruction}. IP Advanced Here: ${ipAdvancedHere}. New IP: ${currentProcess.ip}`);

            // Move to the next process in the queue
            currentProcessIndex++;
        }

        // Check for game end again after potential process death
        if (processQueue.length > 0) {
            const firstWarriorId = processQueue[0].warriorId;
            const allSame = processQueue.every(p => p.warriorId === firstWarriorId);
            if (allSame && warriors.length > 1) {
                 gameOver = true;
                 // console.log(`Game ending: Single warrior remaining.`);
                 break; // Exit the inner loop for this tick
            }
        } else { // No processes left
             gameOver = true;
             // console.log(`Game ending: No processes left.`);
             break; // Exit the inner loop
        }
         // TODO: Add max cycle limit
    }

    // Update visualization after a batch of cycles
    drawMemory();
}

// --- Visualization ---
function drawMemory() {
    // This function is now handled by the renderer
    if (window.game && window.game.renderer) {
        window.game.renderer.clear();
        window.game.renderer.drawGrid();
        
        // Draw memory cells
        for (let i = 0; i < memory.length; i++) {
            if (memory[i]) {
                window.game.renderer.drawCell(i, memory[i]);
            }
        }
    }
}

// Load warriors initially
resetGame(); // Call resetGame initially to load warriors and set initial state

// --- Event Listeners ---
startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', pauseGame);
resetButton.addEventListener('click', resetGame);

speedSlider.addEventListener('input', (event) => {
    cyclesPerTick = parseInt(event.target.value, 10);
    speedValueSpan.textContent = cyclesPerTick;
});

// --- Warrior Info Display ---
function displayWarriorInfo() {
    const listElement = document.getElementById('warriorList');
    if (!listElement) return;

    listElement.innerHTML = ''; // Clear previous entries

    warriors.forEach(warrior => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'warriorEntry';

        // Header (Checkbox + Color Swatch + Name + Status)
        const headerDiv = document.createElement('div');
        headerDiv.className = 'warriorHeader';

        // Add participation checkbox
        const checkboxLabel = document.createElement('label');
        checkboxLabel.className = 'warriorCheckbox';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = warriorParticipation.get(warrior.id);
        checkbox.addEventListener('change', (e) => {
            warriorParticipation.set(warrior.id, e.target.checked);
            // Reset game when participation changes
            if (window.game) {
                window.game.reset();
            }
        });
        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(document.createTextNode(' Active '));

        const swatchSpan = document.createElement('span');
        swatchSpan.className = 'warriorColorSwatch';
        swatchSpan.style.backgroundColor = warrior.color;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'warriorName';
        nameSpan.textContent = warrior.name;

        const statusSpan = document.createElement('span');
        statusSpan.className = 'warriorStatus';
        // Check if warrior has any active processes in the game instance
        const isActive = window.game && window.game.processes.some(process => process.warriorId === warrior.id);
        statusSpan.textContent = isActive ? '(Active)' : '(Dead)';
        statusSpan.style.color = isActive ? '#00ff00' : '#ff0000';
        statusSpan.style.marginLeft = '10px';
        statusSpan.style.fontStyle = 'italic';

        headerDiv.appendChild(checkboxLabel);
        headerDiv.appendChild(swatchSpan);
        headerDiv.appendChild(nameSpan);
        headerDiv.appendChild(statusSpan);

        // Code Block
        const codeDiv = document.createElement('div');
        codeDiv.className = 'warriorCode';
        codeDiv.textContent = warrior.code.map((instr, index) => `${index}: ${instr.toString()}`).join('\n');

        entryDiv.appendChild(headerDiv);
        entryDiv.appendChild(codeDiv);

        listElement.appendChild(entryDiv);
    });
}

console.log("Core Wars JS Initialized with UI Controls");
console.log(`Memory Size: ${MEMORY_SIZE}`);
console.log(`Display Grid: ${MEMORY_COLS}x${MEMORY_ROWS}`);

// Display warrior info once on load
displayWarriorInfo();

// --- Tab Switching Logic ---
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons and content
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Initialize the game
class Game {
    constructor() {
        // Initialize the renderer
        this.renderer = new CoreWarsRenderer();
        
        // Initialize game state
        this.memory = new Array(MEMORY_SIZE).fill(null);
        this.processes = [];
        this.warriors = [];
        this.currentProcessIndex = 0;
        this.cyclesPerTick = parseInt(speedSlider.value, 10);
        this.isRunning = false;
        this.gameOver = false;
        this.gameInterval = null;
        
        // Add process ID counter
        this.nextProcessId = 1;
        
        // Initialize instruction logging
        this.cycleCount = 0;
        this.maxLogEntries = 1000;
        this.instructionLog = document.getElementById('instructionLog');
        this.clearLogButton = document.getElementById('clearLogButton');
        
        // Setup clear log button
        this.clearLogButton.addEventListener('click', () => {
            this.clearInstructionLog();
        });

        // Setup click handler for cell information
        this.renderer.setClickHandler((index, clientX, clientY) => {
            const instruction = this.memory[index];
            if (instruction) {
                const owner = this.warriors.find(w => w.id === instruction.ownerId);
                const ownerName = owner ? owner.name : 'Unknown';
                tooltipElement.innerHTML = `Clicked Addr: ${index}<br>Owner: ${ownerName} (ID: ${instruction.ownerId || 'None'})<br>${instruction.toString()}`;
            } else {
                tooltipElement.innerHTML = `Clicked Addr: ${index}<br>-- Empty --`;
            }
            
            // Position tooltip above the click
            tooltipElement.style.left = `${clientX + 10}px`;
            tooltipElement.style.top = `${clientY - 30}px`;
            tooltipElement.style.visibility = 'visible';
            tooltipElement.style.opacity = '1';
        });

        // Hide tooltip when clicking elsewhere
        document.addEventListener('click', (event) => {
            if (event.target !== this.renderer.canvas) {
                tooltipElement.style.visibility = 'hidden';
            }
        });

        // Setup control handlers
        this.setupControls();
        
        // Load warriors
        this.loadWarriors();
    }

    clearInstructionLog() {
        if (this.instructionLog) {
            this.instructionLog.innerHTML = '';
        }
    }

    logInstruction(process, instruction, address, result) {
        if (!this.instructionLog) return;

        const warrior = this.warriors.find(w => w.id === process.warriorId);
        const warriorName = warrior ? warrior.name : 'Unknown';

        const entry = document.createElement('div');
        entry.className = 'instruction-entry';

        const cycleSpan = document.createElement('span');
        cycleSpan.className = 'instruction-cycle';
        cycleSpan.textContent = `#${this.cycleCount}`;

        const processSpan = document.createElement('span');
        processSpan.className = 'instruction-process';
        processSpan.textContent = `P${process.processId}`;

        const warriorSpan = document.createElement('span');
        warriorSpan.className = 'instruction-warrior';
        warriorSpan.textContent = warriorName;

        const detailsSpan = document.createElement('span');
        detailsSpan.className = 'instruction-details';
        detailsSpan.textContent = `@${address}: ${instruction.toString()}`;

        entry.appendChild(cycleSpan);
        entry.appendChild(processSpan);
        entry.appendChild(warriorSpan);
        entry.appendChild(detailsSpan);

        this.instructionLog.insertBefore(entry, this.instructionLog.firstChild);

        while (this.instructionLog.children.length > this.maxLogEntries) {
            this.instructionLog.removeChild(this.instructionLog.lastChild);
        }
    }

    executeNextInstruction() {
        if (this.processes.length === 0) return false;

        this.currentProcessIndex %= this.processes.length;
        const process = this.processes[this.currentProcessIndex];
        const instruction = this.memory[process.ip];

        if (instruction) {
            this.cycleCount++;
            const result = this.executeInstruction(process);
            this.logInstruction(process, instruction, process.ip, result);
            
            if (!result.survived) {
                this.processes.splice(this.currentProcessIndex, 1);
                // Update warrior status when a process dies
                displayWarriorInfo();
            } else {
                if (!result.advancedIp) {
                    process.ip = (process.ip + 1) % MEMORY_SIZE;
                }
                this.currentProcessIndex++;
            }
        } else {
            // Process tried to execute empty cell
            this.processes.splice(this.currentProcessIndex, 1);
            // Update warrior status when a process dies
            displayWarriorInfo();
        }

        return true;
    }

    reset() {
        this.pause();
        this.memory = new Array(MEMORY_SIZE).fill(null);
        this.processes = [];
        this.currentProcessIndex = 0;
        this.gameOver = false;
        this.cycleCount = 0;
        
        // Clear instruction log
        this.clearInstructionLog();
        
        // Only load participating warriors
        const activeWarriors = this.warriors.filter(w => warriorParticipation.get(w.id));
        const baseSpacing = Math.floor(MEMORY_SIZE / activeWarriors.length);
        
        activeWarriors.forEach((warrior, index) => {
            // Add some randomness to the spacing while maintaining minimum distance
            const offset = Math.floor(baseSpacing * 0.2); // 20% of base spacing for randomness
            const randomOffset = Math.floor(Math.random() * offset * 2) - offset; // Random offset between -offset and +offset
            const startAddress = ((index * baseSpacing) + randomOffset + MEMORY_SIZE) % MEMORY_SIZE;
            
            // Ensure Painter starts with more space
            const adjustedAddress = warrior.name === 'Painter' ? 
                (startAddress + Math.floor(baseSpacing * 0.3)) % MEMORY_SIZE : 
                startAddress;
            
            console.log(`Loading ${warrior.name} at position ${adjustedAddress}`);
            this.loadWarrior(warrior, adjustedAddress);
        });

        this.initializeProcesses();
        this.render();
        displayWarriorInfo();
        
        startButton.disabled = false;
        pauseButton.disabled = true;
    }

    setupControls() {
        startButton.addEventListener('click', () => {
            if (!this.isRunning) {
                this.start();
            }
        });

        pauseButton.addEventListener('click', () => {
            if (this.isRunning) {
                this.pause();
            }
        });

        resetButton.addEventListener('click', () => {
            this.reset();
        });

        speedSlider.addEventListener('input', (e) => {
            this.cyclesPerTick = parseInt(e.target.value);
            speedValueSpan.textContent = this.cyclesPerTick;
        });
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.gameInterval = setInterval(() => this.gameTick(), 50); // 20 fps
            startButton.disabled = true;
            pauseButton.disabled = false;  // Enable pause button when game starts
        }
    }

    pause() {
        if (this.isRunning) {
            this.isRunning = false;
            clearInterval(this.gameInterval);
            this.gameInterval = null;
            startButton.disabled = false;
            pauseButton.disabled = true;  // Disable pause button when game is paused
        }
    }

    gameTick() {
        if (this.gameOver || this.processes.length === 0) {
            this.handleGameOver();
            return;
        }

        // Execute instructions
        for (let i = 0; i < this.cyclesPerTick; i++) {
            if (this.processes.length === 0) {
                this.handleGameOver();
                return;
            }

            this.executeNextInstruction();
            
            // Check for game over conditions after each instruction
            if (this.checkGameOver()) {
                this.handleGameOver();
                return;
            }
        }

        // Update display
        this.render();
        displayWarriorInfo();
    }

    handleGameOver() {
        // Make sure we set the gameOver flag
        this.gameOver = true;
        
        // Stop the game interval
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
            this.gameInterval = null;
        }
        
        // Stop the game
        this.isRunning = false;
        
        // Determine and announce winner
        if (this.processes.length > 0) {
            const winner = this.warriors.find(w => w.id === this.processes[0].warriorId);
            console.log(`Winner: ${winner?.name || 'Unknown'}`);
        } else {
            console.log("No warriors survived.");
        }
        
        // Update UI
        startButton.disabled = true;
        pauseButton.disabled = true;
        
        // Update warrior status display one final time
        displayWarriorInfo();
        
        // Final render to show end state
        this.render();
    }

    checkGameOver() {
        if (this.processes.length === 0) {
            return true;
        }

        if (this.processes.length > 0) {
            const firstWarriorId = this.processes[0].warriorId;
            const allSame = this.processes.every(p => p.warriorId === firstWarriorId);
            if (allSame && this.warriors.filter(w => warriorParticipation.get(w.id)).length > 1) {
                return true;
            }
        }

        return false;
    }

    render() {
        // Clear and draw grid
        this.renderer.clear();
        this.renderer.drawGrid();

        // Draw memory cells
        for (let i = 0; i < this.memory.length; i++) {
            if (this.memory[i]) {
                this.renderer.drawCell(i, this.memory[i]);
            }
        }
    }

    loadWarriors() {
        // Only load warriors that are marked as participating
        this.warriors = warriors
            .filter(warrior => warriorParticipation.get(warrior.id))
            .map(warrior => ({
                id: warrior.id,
                name: warrior.name,
                color: warrior.color,
                code: warrior.code.map(instr => 
                    new Instruction(
                        instr.opcode,
                        instr.aMode, instr.aValue,
                        instr.bMode, instr.bValue,
                        warrior.id
                    )
                )
            }));
        
        this.reset();
    }

    loadWarrior(warrior, startAddress) {
        warrior.code.forEach((instr, i) => {
            const address = (startAddress + i) % MEMORY_SIZE;
            // Assign ownerId when loading
            this.memory[address] = new Instruction(
                instr.opcode,
                instr.aMode, instr.aValue,
                instr.bMode, instr.bValue,
                warrior.id
            );
            console.log(`Loading ${warrior.name} instruction ${i} at ${address}: ${this.memory[address]}`);
        });
    }

    executeInstruction(process) {
        const instruction = this.memory[process.ip];
        let advanceIp = true;

        if (!instruction || instruction.opcode === Opcode.DAT) {
            console.log(`Process ${process.processId} for Warrior ${process.warriorId} died at IP ${process.ip}`);
            return { survived: false, advancedIp: false };
        }

        const owner = this.warriors.find(w => w.id === process.warriorId);
        let sourceAddress, destinationAddress;
        let sourceInstruction, valueA, valueB, targetAddress, destInstruction;

        switch (instruction.opcode) {
            case Opcode.MOV:
                destinationAddress = this.getEffectiveAddress(process.ip, instruction.bMode, instruction.bValue);

                if (instruction.aMode === AddressingMode.IMMEDIATE) {
                    sourceInstruction = new Instruction(Opcode.DAT, AddressingMode.IMMEDIATE, 0, AddressingMode.IMMEDIATE, instruction.aValue, null);
                } else {
                    sourceAddress = this.getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                    const sourceContent = this.memory[sourceAddress];
                    if (sourceContent) {
                        sourceInstruction = new Instruction(
                            sourceContent.opcode,
                            sourceContent.aMode, sourceContent.aValue,
                            sourceContent.bMode, sourceContent.bValue,
                            sourceContent.ownerId
                        );
                    } else {
                        sourceInstruction = new Instruction(Opcode.DAT, AddressingMode.IMMEDIATE, 0, AddressingMode.IMMEDIATE, 0, null);
                    }
                }

                sourceInstruction.ownerId = process.warriorId;
                this.memory[destinationAddress] = sourceInstruction;
                break;

            case Opcode.ADD:
                // Get destination address (from B operand)
                destinationAddress = this.getEffectiveAddress(process.ip, instruction.bMode, instruction.bValue);
                destInstruction = this.memory[destinationAddress];

                if (destInstruction) {
                    // Get the value specified by the A operand
                    if (instruction.aMode === AddressingMode.IMMEDIATE) {
                        valueA = instruction.aValue;
                    } else {
                        // Non-immediate A: Get value from effective address A, specifically the B-field (common interpretation)
                        const sourceAAddress = this.getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                        const sourceAInstr = this.memory[sourceAAddress];
                        valueA = sourceAInstr ? sourceAInstr.bValue : 0;
                    }

                    // Simple ADD: Add A-operand's value to the B-field of the destination instruction.
                    valueB = destInstruction.bValue;
                    const resultB = (valueA + valueB);

                    // Update only the B-field of the destination instruction
                    this.memory[destinationAddress] = new Instruction(
                        destInstruction.opcode,
                        destInstruction.aMode, destInstruction.aValue, // Keep original A-field
                        destInstruction.bMode, (resultB % MEMORY_SIZE + MEMORY_SIZE) % MEMORY_SIZE, // Store result in B-field, wrap
                        process.warriorId // Destination instruction owned by current warrior
                     );
                } else {
                    // What to do if destination is empty? Treat as DAT #0, #0? Ignore?
                    console.warn(`ADD targeting empty cell @ ${destinationAddress}. Operation skipped.`);
                }
                break;

            case Opcode.JMP:
                targetAddress = this.getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                process.ip = targetAddress;
                advanceIp = false; // Do not perform the standard IP increment
                break;

            case Opcode.SPL:
                targetAddress = this.getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                const newProcess = { 
                    warriorId: process.warriorId, 
                    ip: targetAddress,
                    processId: this.nextProcessId++
                };
                this.processes.push(newProcess);
                console.log(`SPL: Created new process ${newProcess.processId} at ${targetAddress} from parent process ${process.processId}`);
                break;

            case Opcode.SUB:
                 // Similar to ADD, but subtracts
                destinationAddress = this.getEffectiveAddress(process.ip, instruction.bMode, instruction.bValue);
                destInstruction = this.memory[destinationAddress];

                if (destInstruction) {
                    // Get the value specified by the A operand
                    if (instruction.aMode === AddressingMode.IMMEDIATE) {
                        valueA = instruction.aValue;
                    } else {
                        const sourceAAddress = this.getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                        const sourceAInstr = this.memory[sourceAAddress];
                        valueA = sourceAInstr ? sourceAInstr.bValue : 0;
                    }

                    // SUB: Subtract A-operand's value from the B-field of the destination instruction.
                    valueB = destInstruction.bValue;
                    let resultB = (valueB - valueA);

                    // Update only the B-field
                    this.memory[destinationAddress] = new Instruction(
                        destInstruction.opcode,
                        destInstruction.aMode, destInstruction.aValue,
                        destInstruction.bMode, (resultB % MEMORY_SIZE + MEMORY_SIZE) % MEMORY_SIZE, // Wrap result
                        process.warriorId
                     );
                } else {
                    console.warn(`SUB targeting empty cell @ ${destinationAddress}. Operation skipped.`);
                }
                break;

            case Opcode.JMZ: // Jump to A if B is zero
                destinationAddress = this.getEffectiveAddress(process.ip, instruction.bMode, instruction.bValue);
                destInstruction = this.memory[destinationAddress];
                valueB = destInstruction ? destInstruction.bValue : 0; // Get B-field value, or 0 if empty

                if (valueB === 0) {
                    targetAddress = this.getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                    process.ip = targetAddress;
                    advanceIp = false; // IP handled by jump
                }
                break;

            case Opcode.DJN: // Decrement B, Jump to A if B is non-zero
                destinationAddress = this.getEffectiveAddress(process.ip, instruction.bMode, instruction.bValue);
                destInstruction = this.memory[destinationAddress];

                if (destInstruction) {
                    // Decrement the B-field of the destination instruction
                    valueB = destInstruction.bValue;
                    resultB = valueB - 1;
                    const wrappedResultB = (resultB % MEMORY_SIZE + MEMORY_SIZE) % MEMORY_SIZE;

                    this.memory[destinationAddress] = new Instruction(
                        destInstruction.opcode,
                        destInstruction.aMode, destInstruction.aValue,
                        destInstruction.bMode, wrappedResultB,
                        process.warriorId
                     );

                    // Check if the *decremented* value is non-zero
                    if (wrappedResultB !== 0) {
                        targetAddress = this.getEffectiveAddress(process.ip, instruction.aMode, instruction.aValue);
                        process.ip = targetAddress;
                        advanceIp = false; // IP handled by jump
                    }
                }
                break;

            // TODO: Implement other opcodes...

            default:
                console.warn(`Unimplemented opcode: ${instruction.opcode} at IP ${process.ip}`);
                // Treat as NOP for now - just advance IP
                break;
        }

        return { survived: true, advancedIp: !advanceIp };
    }

    getEffectiveAddress(currentIp, mode, value) {
        let address;
        switch (mode) {
            case AddressingMode.DIRECT:
                address = (currentIp + value) % MEMORY_SIZE;
                break;
            case AddressingMode.INDIRECT:
                const intermediateAddress = (currentIp + value) % MEMORY_SIZE;
                const intermediateInstruction = this.memory[intermediateAddress];
                const offset = intermediateInstruction ? intermediateInstruction.bValue : 0;
                address = (currentIp + offset) % MEMORY_SIZE;
                break;
            case AddressingMode.IMMEDIATE:
                return currentIp;
            default:
                console.warn(`Unsupported addressing mode for getEffectiveAddress: ${mode}`);
                address = (currentIp + value) % MEMORY_SIZE;
                break;
        }
        return (address + MEMORY_SIZE) % MEMORY_SIZE;
    }

    initializeProcesses() {
        this.processes = [];
        this.nextProcessId = 1; // Reset process ID counter
        
        this.warriors.forEach(warrior => {
            const startAddress = this.memory.findIndex(instr => instr && instr.ownerId === warrior.id);
            if (startAddress !== -1) {
                this.processes.push({ 
                    warriorId: warrior.id, 
                    ip: startAddress,
                    processId: this.nextProcessId++
                });
                console.log(`Initialized process ${this.nextProcessId-1} for ${warrior.name} (ID: ${warrior.id}) at IP: ${startAddress}`);
            } else {
                console.error(`Could not find starting instruction for warrior ${warrior.name}`);
            }
        });
        this.currentProcessIndex = 0;
        this.gameOver = false;
    }

    // ... rest of the Game class methods ...
}

// Initialize game when window loads
window.addEventListener('load', () => {
    window.game = new Game(); // Make it accessible for debugging
});

