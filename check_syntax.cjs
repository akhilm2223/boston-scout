const fs = require('fs');
const content = fs.readFileSync('src/components/Map3D.tsx', 'utf8');

const stack = [];
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '{' || char === '(' || char === '[') {
            stack.push({ char, line: i + 1, col: j + 1 });
        } else if (char === '}' || char === ')' || char === ']') {
            if (stack.length === 0) {
                console.error(`Unexpected ${char} at line ${i + 1}:${j + 1}`);
                process.exit(1);
            }
            const last = stack.pop();
            if ((char === '}' && last.char !== '{') ||
                (char === ')' && last.char !== '(') ||
                (char === ']' && last.char !== '[')) {
                console.error(`Mismatched ${char} at line ${i + 1}:${j + 1}. Expected closing for ${last.char} from line ${last.line}:${last.col}`);
                process.exit(1);
            }
        }
    }
}

if (stack.length > 0) {
    const last = stack[stack.length - 1];
    console.error(`Unclosed ${last.char} from line ${last.line}:${last.col}`);
} else {
    console.log('No syntax errors found relative to braces/parens.');
}
