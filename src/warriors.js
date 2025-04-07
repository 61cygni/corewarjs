import { Instruction, Opcode, AddressingMode, parseInstruction } from './machine.js';

let usedNames = new Map();

export let warriorColors = new Map();

// list of unique, high contrast colors
let colors = [
    '#FF0000', // Red
    '#00FF00', // Lime Green
    '#0000FF', // Blue
    '#FFFF00', // Yellow 
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
    '#FFA500', // Orange
    '#800080', // Purple
    '#FF1493', // Deep Pink
    '#32CD32', // Lime
    '#4169E1', // Royal Blue
    '#FF4500', // Orange Red
    '#8A2BE2', // Blue Violet
    '#00FA9A', // Medium Spring Green
    '#DC143C', // Crimson
    '#9400D3', // Dark Violet
    '#FF8C00', // Dark Orange
    '#20B2AA', // Light Sea Green
    '#FF69B4', // Hot Pink
    '#7CFC00', // Lawn Green
    '#4B0082', // Indigo
];

// --- Warrior Definitions ---
export const warriors = [
];

export function addWarrior(name, code, color = '#ff0000') {

    if (usedNames.has(name)) {
        console.log("Warrior already exists: " + name);
        return;
    }

    console.log("Adding warrior: " + name);

    let codesplit = code.split('\n');
    let codelist = [];
    for (let i = 0; i < codesplit.length; i++) {
        if (codesplit[i].trim() !== '') {
            console.log("\t" + i + ": " + codesplit[i]);
            codelist.push(parseInstruction(codesplit[i]));
        }
    }

    if (warriors.length >= colors.length) { 
        console.log("Not enough colors, reverting to random");
        color = '#' + (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0');
    } else {
        color = colors[warriors.length];
    }
    warriors.push({ id: warriors.length + 1, name: name, color: color, code: codelist });

    usedNames.set(name, true);

    warriorColors.set(warriors.length, color);
}

// --- Warrior Definitions ---

addWarrior('Imp', `
    MOV 0, $1
`);

addWarrior('Dwarf', `
    ADD #101, 3
    MOV 2, @2
    JMP -2, 0
    DAT #0, #0
`);

addWarrior('Splasher',`
    SPL 3, 0
    ADD #17, 4
    JMP -2, 0
    MOV 1, @2
    DAT 0, 0
    DAT 0, 101
`);


addWarrior('Hydra', `
    SPL 3, 0
    ADD 4, 4
    JMP -2, 0
    MOV 3, @2
    JMP -1, 0
    DAT 0, 300
    DAT 0, 555
`);

addWarrior('Bomber', `
    ADD 4, 3
    MOV 3, @2
    JMP -2, 0
    DAT 0, 300
    DAT 0, 555
`);

addWarrior('Reaper', `
    MOV $3, @3
    SUB #28, $2
    JMP $-2, #0
    DAT #0, #-980
`);