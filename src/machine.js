
// --- Redcode Definitions ---
export const Opcode = {
    MOV: 'MOV', // Move data
    ADD: 'ADD', // Add A to B, store in B
    SUB: 'SUB', // Subtract A from B, store in B
    JMP: 'JMP', // Jump to A
    JMZ: 'JMZ', // Jump to A if B is zero
    DJN: 'DJN', // Decrement B, Jump to A if B is non-zero
    SPL: 'SPL', // Split execution, start new process at A
    DAT: 'DAT', // Data (kills process)
};

export const AddressingMode = {
    IMMEDIATE: '#', // Value is the operand itself
    DIRECT: '$',    // Operand is an address relative to the current instruction
    INDIRECT: '@',  // Address is value in B-field at (current IP + operand value)
    // Add PREDECREMENT etc. later
};

// Simple instruction class
export class Instruction {
    constructor(opcode, aMode, aValue, bMode, bValue, ownerId = null) {
        this.opcode = opcode;
        this.aMode = aMode;
        this.aValue = aValue;
        this.bMode = bMode;
        this.bValue = bValue;
        this.ownerId = ownerId; // To track which warrior owns this instruction
    }

    // Basic string representation for debugging
    toString() {
        return `${this.opcode} ${this.aMode}${this.aValue}, ${this.bMode}${this.bValue}`;
    }
}

// help function to parse a string into an instruction

/**
 * Parses a Redcode assembly instruction string into an Instruction object
 * @param {string} instructionStr - The instruction string (e.g., "MOV #0, $1")
 * @param {number} [ownerId=null] - Optional owner ID for the instruction
 * @returns {Instruction} The parsed instruction object
 * @throws {Error} If the instruction string is invalid
 */
export function parseInstruction(instructionStr, ownerId = null) {
    // Remove extra whitespace and split into parts
    const parts = instructionStr.trim().toUpperCase().split(/\s*,\s*/);
    if (parts.length !== 2) {
        throw new Error('Invalid instruction format. Expected "OPCODE A, B"');
    }

    // Split first part into opcode and A operand
    const [opcode, operandA] = parts[0].trim().split(/\s+/);
    const operandB = parts[1].trim();

    // Validate opcode
    if (!Opcode[opcode]) {
        throw new Error(`Invalid opcode: ${opcode}`);
    }

    // Parse addressing modes and values for both operands
    function parseOperand(operand) {
        let mode, value;
        
        if (operand.startsWith('#')) {
            mode = AddressingMode.IMMEDIATE;
            value = parseInt(operand.substring(1));
        } else if (operand.startsWith('$')) {
            mode = AddressingMode.DIRECT;
            value = parseInt(operand.substring(1));
        } else if (operand.startsWith('@')) {
            mode = AddressingMode.INDIRECT;
            value = parseInt(operand.substring(1));
        } else {
            // Default to DIRECT mode if no prefix
            mode = AddressingMode.DIRECT;
            value = parseInt(operand);
        }

        if (isNaN(value)) {
            throw new Error(`Invalid operand value: ${operand}`);
        }

        return { mode, value };
    }

    const { mode: aMode, value: aValue } = parseOperand(operandA);
    const { mode: bMode, value: bValue } = parseOperand(operandB);

    return new Instruction(opcode, aMode, aValue, bMode, bValue, ownerId);
} 