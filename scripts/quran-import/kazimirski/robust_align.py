import json, difflib, bisect, sys

results = json.load(open('concordance_analysis.json'))

def word_ranges(items):
    ranges = {}
    pos = 0
    for num, txt in items:
        words = txt.split()
        ranges[num] = (pos, pos+len(words))
        pos += len(words)
    return ranges, pos

def build_map(Lwords, Rwords):
    sm = difflib.SequenceMatcher(None, Lwords, Rwords, autojunk=False)
    ops = sm.get_opcodes()
    anchors = [(0,0)]
    for tag,i1,i2,j1,j2 in ops:
        anchors.append((i1,j1))
        anchors.append((i2,j2))
    anchors = sorted(set(anchors))
    idxs = [a[0] for a in anchors]
    def map_pos(i):
        pos = bisect.bisect_right(idxs, i) - 1
        pos = max(0, min(pos, len(anchors)-2))
        i0, j0 = anchors[pos]
        i1_, j1_ = anchors[pos+1]
        if i1_ == i0:
            return j0
        frac = (i - i0) / (i1_ - i0)
        return j0 + frac*(j1_-j0)
    return map_pos

def analyze_robust(s):
    r = results[str(s)]
    Litems = r['Litems']; Ritems = r['Ritems']
    Lr, Lp = word_ranges(Litems)
    Rr, Rp = word_ranges(Ritems)
    Lwords = []
    for n,t in Litems: Lwords.extend(t.split())
    Rwords = []
    for n,t in Ritems: Rwords.extend(t.split())
    mapfn = build_map(Lwords, Rwords)
    # precompute mapped L ranges once
    Lr_mapped = {ln:(mapfn(a), mapfn(b)) for ln,(a,b) in Lr.items()}
    l_to_r = {}
    for ln,(ma,mb) in Lr_mapped.items():
        ov = sorted([rn for rn,(c,d) in Rr.items() if c < mb-0.5 and d > ma+0.5])
        l_to_r[ln] = ov
    r_to_l = {}
    for rn,(c,d) in Rr.items():
        ov = sorted([ln for ln,(ma,mb) in Lr_mapped.items() if ma < d-0.5 and mb > c+0.5])
        r_to_l[rn] = ov
    return l_to_r, r_to_l, Litems, Ritems

if __name__ == '__main__':
    s = int(sys.argv[1])
    l_to_r, r_to_l, Litems, Ritems = analyze_robust(s)
    splits = {n:v for n,v in l_to_r.items() if len(v)>1}
    merges = {m:v for m,v in r_to_l.items() if len(v)>1}
    print(f'S{s} splits:', len(splits))
    print(f'S{s} merges:', len(merges))
    print(list(splits.items())[:10])
    print(list(merges.items())[:10])
