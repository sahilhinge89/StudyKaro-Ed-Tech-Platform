import os, re

unused = []
for root, dirs, files in os.walk('src'):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for f in sorted(files):
        if not f.endswith(('.js', '.jsx')):
            continue
        p = os.path.join(root, f)
        lines = open(p, encoding='utf8', errors='ignore').read().split('\n')
        imports = []
        for i, l in enumerate(lines):
            m = re.match(r'\s*import\s+(.*?)\s+from\s+', l)
            if not m:
                continue
            clause = m.group(1)
            names = []
            dm = re.match(r'^\{([^}]*)\}$', clause)
            if dm:
                for part in dm.group(1).split(','):
                    part = part.strip()
                    if not part:
                        continue
                    if ' as ' in part:
                        part = part.split(' as ')[-1].strip()
                    names.append(part)
            else:
                for part in clause.split(','):
                    part = part.strip()
                    if not part or part.startswith('*'):
                        continue
                    part = part.replace('{', '').replace('}', '').strip()
                    if not part:
                        continue
                    if ' as ' in part:
                        part = part.split(' as ')[-1].strip()
                    names.append(part)
            for n in names:
                if n:
                    imports.append((i + 1, n))
        body = '\n'.join(l for l in lines if not re.match(r'\s*import\s', l))
        for ln, n in imports:
            if n == 'React':
                continue
            if not re.search(r'\b' + re.escape(n) + r'\b', body):
                unused.append((p, ln, n))

for p, ln, n in unused:
    print('%s:%s unused import -> %s' % (p, ln, n))
print('TOTAL unused imports:', len(unused))
