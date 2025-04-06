import { Instruction, Opcode, AddressingMode, parseInstruction } from './machine.js';

// --- Warrior Definitions ---
export const warriors = [
    {
        id: 1, // Warrior ID (used for coloring)
        name: 'IMP',
        color: '#ff0000', // Red
        code: [
            new Instruction(Opcode.MOV, AddressingMode.IMMEDIATE, 0, AddressingMode.DIRECT, 1) // MOV #0, $1
        ]
    },
    {
        id: 2, // Warrior ID
        name: 'Dwarf',
        color: '#0000ff', // Blue
        code: [
            // ADD #101, 3 ; Use a larger step for bombing offset
            new Instruction(Opcode.ADD, AddressingMode.IMMEDIATE, 101, AddressingMode.DIRECT, 3),
            // MOV 2, @2   ; Move the DAT instruction (at relative address 2) to the address pointed to by the B-field at relative address 2
            new Instruction(Opcode.MOV, AddressingMode.DIRECT, 2, AddressingMode.INDIRECT, 2),
            // JMP -2      ; Jump back 2 instructions (to the ADD)
            new Instruction(Opcode.JMP, AddressingMode.DIRECT, -2, AddressingMode.DIRECT, 0), // B-field ignored for JMP
            // DAT #0, #0  ; The bomb itself. Initial value doesn't matter much here, but often non-zero.
            new Instruction(Opcode.DAT, AddressingMode.IMMEDIATE, 0, AddressingMode.IMMEDIATE, 0)
        ]
    },
    {
        id: 3, // Warrior ID
        name: 'Splasher',
        color: '#00ff00', // Green
        code: [
            // Core Loop
            new Instruction(Opcode.SPL, AddressingMode.DIRECT, 3, AddressingMode.DIRECT, 0), // SPL 3 (to MOV)
            new Instruction(Opcode.ADD, AddressingMode.IMMEDIATE, 17, AddressingMode.DIRECT, 4),// ADD #17, 4 (modify B-field of Pointer DAT @ relative 4 -> actual index 5)
            new Instruction(Opcode.JMP, AddressingMode.DIRECT, -2, AddressingMode.DIRECT, 0), // JMP -2 (back to SPL)
            // Bomb Routine
            new Instruction(Opcode.MOV, AddressingMode.DIRECT, 1, AddressingMode.INDIRECT, 2),// Corrected: MOV 1, @2 (Bomb DAT is +1, Pointer DAT is +2 from here)
            // Data
            new Instruction(Opcode.DAT, AddressingMode.IMMEDIATE, 0, AddressingMode.IMMEDIATE, 0),    // The Bomb DAT (relative 4)
            new Instruction(Opcode.DAT, AddressingMode.IMMEDIATE, 0, AddressingMode.IMMEDIATE, 101)  // The Pointer DAT (relative 5)
        ]
    },
    {
        id: 5, // Warrior ID
        name: 'Hydra',
        color: '#00ffff', // Cyan
        code: [

            // Main Loop (0-2)
            /* 0 */ parseInstruction('SPL 3, $0'), // Clone child at IP + 3
            /* 1 */ parseInstruction('ADD 4, $4'), // Add 4 to B-field IP + 4 (bomb location) 
            /* 2 */ parseInstruction('JMP $-2, $0'), // Jump back 2 instructions (to the SPL)
            // Child Loop (3-4)
            /* 3 */ parseInstruction('MOV 3, @2'), // Send bomb to location pointed to by B-field at IP + 2
            /* 4 */ parseInstruction('JMP $-1, $0'), // Jump back 1 instruction (to the ADD)
            // Bomb (5-6)
            /* 5 */ parseInstruction('DAT 0, 300'), // Location of the bomb 
            /* 6 */ parseInstruction('DAT 0, 555')  // the bomb itself
        ]
    },
    {
        id: 6, // Warrior ID
        name: 'Reaper',
        color: '#ffa500', // Orange
        code: [
            //redcode
            //name Midget
            //author Chip Wendell
            //strategy stone (bomber)
            //history Third place at the 1986 ICWS tournament
            //Bomb	dat	#0,	#-980
            //Spacer	equ	28
            //Start	mov	Bomb,	@Bomb
            //sub	#Spacer,Bomb
            //jmp	Start,	#0
            //end	Start
            /* 0 */ parseInstruction('MOV $3, @3'), 
            /* 1 */ parseInstruction('SUB #28, $2'), 
            /* 2 */ parseInstruction('JMP $-2, #0'),
            /* 3 */ parseInstruction('DAT #0, #-980') 
        ]
    },
    {
        id: 7, // Warrior ID
        name: 'Imp2',
        color: '#ffff00', // Yellow
        code: [
            // Copies itself one step forward repeatedly
            new Instruction(Opcode.MOV, AddressingMode.DIRECT, 0, AddressingMode.DIRECT, 1) // MOV $0, $1
        ]
    },
    {
        id: 8,
        name: 'Bomber',
        color: '#ff1493', // Deep Pink
        code: [
            // Main Loop (0-2)
            /* 0 */ parseInstruction('ADD 4, $3'), // Add 4 to 4 (bomb location) 
            /* 1 */ parseInstruction('MOV 3, @2'), // Send bomb to location pointed to by B-field at IP + 2
            /* 2 */ parseInstruction('JMP $-2, $0'), // Jump back 2 instructions (to the ADD)
            /* 3 */ parseInstruction('DAT 0, 300'), // Location of the bomb 
            /* 4 */ parseInstruction('DAT 0, 555')  // the bomb itself
        ]
    }
];