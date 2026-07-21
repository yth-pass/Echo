"""
Generate 14 expressions on both boy and girl base images.
28 total icons: 14 boy + 14 girl
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from PIL import Image, ImageDraw
import os

OUT_DIR = "icons_gender"
os.makedirs(OUT_DIR, exist_ok=True)

# Load both base images
BOY_BASE = "echo_boy_wo_expression.png"
GIRL_BASE = "echo_girl_wo_expression.png"

boy_img = Image.open(BOY_BASE).convert("RGBA")
girl_img = Image.open(GIRL_BASE).convert("RGBA")
W, H = boy_img.size
print(f"Base size: {W}x{H}")

# Feature positions (relative to 1024x1024, both images same size)
# These match the blush circle positions in the "wo_expression" images
EYE_L = (int(W*0.38), int(H*0.52))
EYE_R = (int(W*0.62), int(H*0.52))
EYE_RAD = int(W*0.035)

MOUTH_X = int(W*0.50)
MOUTH_Y = int(H*0.62)

# Colors
DARK = "#1E1B4B"
WHITE = "#FFFFFF"
PINK = "#EC4899"
LT_PINK = "#F472B6"
BLUE = "#93C5FD"

# ─── EYE DRAWERS ───
def normal_eyes(d, ex, ey):
    r = EYE_RAD
    for cx, cy in [ex, ey]:
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=DARK)
        hr = int(r*0.35)
        d.ellipse([cx+int(r*0.3)-hr, cy-int(r*0.3)-hr, cx+int(r*0.3)+hr, cy-int(r*0.3)+hr], fill=WHITE)

def wink_eyes(d, ex, ey):
    r = EYE_RAD
    # Right normal
    cx, cy = ey
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=DARK)
    hr = int(r*0.35)
    d.ellipse([cx+int(r*0.3)-hr, cy-int(r*0.3)-hr, cx+int(r*0.3)+hr, cy-int(r*0.3)+hr], fill=WHITE)
    # Left wink (arch)
    cx, cy = ex
    d.arc([cx-r, cy, cx+r, cy+r], start=180, end=360, fill=DARK, width=max(3, int(r*0.4)))

def heart_eyes(d, ex, ey):
    for cx, cy in [ex, ey]:
        r = EYE_RAD
        d.ellipse([cx-r-4, cy-r, cx-2, cy+r], fill=PINK)
        d.ellipse([cx+2, cy-r, cx+r+4, cy+r], fill=PINK)
        d.polygon([cx-r-4, cy, cx+r+4, cy, cx, cy+r+5], fill=PINK)

def surprised_eyes(d, ex, ey):
    for cx, cy in [ex, ey]:
        r = EYE_RAD + 6
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=DARK)
        pr = 5
        d.ellipse([cx-pr, cy-pr, cx+pr, cy+pr], fill=WHITE)

def shy_eyes(d, ex, ey):
    shift = int(W*0.025)
    for cx, cy in [ex, ey]:
        cx2 = cx - shift
        r = EYE_RAD
        d.ellipse([cx2-r, cy-r, cx2+r, cy+r], fill=DARK)
        hr = int(r*0.35)
        d.ellipse([cx2+int(r*0.3)-hr, cy-int(r*0.3)-hr, cx2+int(r*0.3)+hr, cy-int(r*0.3)+hr], fill=WHITE)

def laugh_eyes(d, ex, ey):
    for cx, cy in [ex, ey]:
        r = EYE_RAD + 3
        d.arc([cx-r, cy-4, cx+r, cy+r], start=180, end=360, fill=DARK, width=4)

def cool_eyes(d, ex, ey):
    gw = EYE_RAD*2 + 10
    gh = EYE_RAD + 8
    for cx, cy in [ex, ey]:
        d.rectangle([cx-gw//2, cy-gh//2, cx+gw//2, cy+gh//2], fill=DARK)
    # Bridge
    d.rectangle([ex[0]+gw//2, ex[1]-3, ey[0]-gw//2, ex[1]+3], fill=DARK)

def think_eyes(d, ex, ey):
    r = EYE_RAD
    # Right normal
    cx, cy = ey
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=DARK)
    hr = int(r*0.35)
    d.ellipse([cx+int(r*0.3)-hr, cy-int(r*0.3)-hr, cx+int(r*0.3)+hr, cy-int(r*0.3)+hr], fill=WHITE)
    # Left squint
    cx, cy = ex
    d.ellipse([cx-r, cy-r+3, cx+r, cy+r-3], fill=DARK)
    d.ellipse([cx+int(r*0.3)-hr, cy-int(r*0.3)+3-hr, cx+int(r*0.3)+hr, cy-int(r*0.3)+3+hr], fill=WHITE)

def sleepy_eyes(d, ex, ey):
    for cx, cy in [ex, ey]:
        r = EYE_RAD + 2
        d.arc([cx-r, cy+3, cx+r, cy+r+6], start=180, end=360, fill=DARK, width=4)

def angry_eyes(d, ex, ey):
    for cx, cy in [ex, ey]:
        r = EYE_RAD
        d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=DARK)
        hr = int(r*0.25)
        d.ellipse([cx+int(r*0.2)-hr, cy-int(r*0.2)-hr, cx+int(r*0.2)+hr, cy-int(r*0.2)+hr], fill=WHITE)
    # Eyebrows
    for cx, cy in [ex, ey]:
        bw = r + 5
        d.line([cx-bw, cy-r-8, cx+bw, cy-r], fill=DARK, width=4)

# ─── MOUTH DRAWERS ───
def smile(d):
    mw = int(W*0.05)
    d.arc([MOUTH_X-mw//2, MOUTH_Y-15, MOUTH_X+mw//2, MOUTH_Y+15], start=0, end=180, fill=DARK, width=4)

def wink_mouth(d):
    mw = int(W*0.04)
    d.arc([MOUTH_X-mw//2, MOUTH_Y-10, MOUTH_X+mw//2, MOUTH_Y+12], start=0, end=180, fill=DARK, width=4)
    # Tongue
    d.ellipse([MOUTH_X, MOUTH_Y+2, MOUTH_X+10, MOUTH_Y+12], fill=LT_PINK)

def heart_mouth(d):
    mw = int(W*0.025)
    d.arc([MOUTH_X-mw, MOUTH_Y-12, MOUTH_X+mw, MOUTH_Y+8], start=0, end=180, fill=DARK, width=4)

def surprised_mouth(d):
    r = 12
    d.ellipse([MOUTH_X-r, MOUTH_Y, MOUTH_X+r, MOUTH_Y+16], fill=DARK)

def shy_mouth(d):
    mw = 10
    d.arc([MOUTH_X-mw, MOUTH_Y-3, MOUTH_X-mw//2, MOUTH_Y+4], start=0, end=180, fill=DARK, width=3)
    d.line([MOUTH_X-mw//2, MOUTH_Y+4, MOUTH_X+mw//2, MOUTH_Y-4, MOUTH_X+mw, MOUTH_Y+4], fill=DARK, width=3)

def laugh_mouth(d):
    mw = 22
    d.ellipse([MOUTH_X-mw, MOUTH_Y, MOUTH_X+mw, MOUTH_Y+mw], fill=DARK)
    d.rectangle([MOUTH_X-mw+2, MOUTH_Y, MOUTH_X+mw-2, MOUTH_Y+mw//2], fill=WHITE)
    d.line([MOUTH_X, MOUTH_Y, MOUTH_X, MOUTH_Y+mw//2], fill=DARK, width=2)
    # Tears
    for tx in [MOUTH_X-mw-6, MOUTH_X+mw+6]:
        d.ellipse([tx-3, MOUTH_Y-6, tx+3, MOUTH_Y], fill=BLUE)

def cool_mouth(d):
    mw = int(W*0.035)
    d.arc([MOUTH_X-mw, MOUTH_Y-3, MOUTH_X+mw, MOUTH_Y+10], start=20, end=160, fill=DARK, width=4)

def angry_mouth(d):
    mw = 15
    d.rectangle([MOUTH_X-mw, MOUTH_Y-4, MOUTH_X+mw, MOUTH_Y+4], fill=DARK)
    for i in range(-mw+3, mw, 4):
        d.line([MOUTH_X+i, MOUTH_Y-4, MOUTH_X+i, MOUTH_Y+4], fill=WHITE, width=1)

def sleepy_mouth(d):
    r = 9
    d.ellipse([MOUTH_X-r, MOUTH_Y+2, MOUTH_X+r, MOUTH_Y+12], fill=DARK)

# ─── EXTRAS ───
def sweat(d):
    sx, sy = int(W*0.57), int(H*0.42)
    d.ellipse([sx-5, sy-8, sx+5, sy+6], fill=BLUE)

def zzz(d):
    zx, zy = int(W*0.62), int(H*0.38)
    d.text((zx, zy), "z", fill=BLUE)
    d.text((zx+12, zy-12), "z", fill=BLUE)
    d.text((zx+24, zy-24), "z", fill=BLUE)

def question(d):
    qx, qy = int(W*0.60), int(H*0.40)
    d.text((qx, qy), "?", fill=DARK)

def party_hat(d):
    hx, hy = int(W*0.50), int(H*0.34)
    hw, hh = 35, 45
    d.polygon([hx, hy-hh, hx-hw//2, hy, hx+hw//2, hy], fill=(245, 158, 11, 240))
    d.ellipse([hx-5, hy-hh-8, hx+5, hy-hh], fill=(239, 68, 68, 240))

def confetti(d):
    import random
    colors = [(236, 72, 153, 200), (245, 158, 11, 200), (16, 185, 129, 200), (59, 130, 246, 200)]
    for _ in range(12):
        x = random.randint(int(W*0.25), int(W*0.75))
        y = random.randint(int(H*0.15), int(H*0.35))
        r = random.randint(2, 5)
        d.ellipse([x-r, y-r, x+r, y+r], fill=random.choice(colors))

# ─── GENERATION ───
def process(name, eye_fn, mouth_fn, extra_fn=None):
    """Process both boy and girl versions"""
    # Boy version
    out = boy_img.copy()
    d = ImageDraw.Draw(out)
    eye_fn(d, EYE_L, EYE_R)
    mouth_fn(d)
    if extra_fn:
        extra_fn(d)
    out.save(os.path.join(OUT_DIR, f"boy_{name}.png"), "PNG")
    
    # Girl version
    out = girl_img.copy()
    d = ImageDraw.Draw(out)
    eye_fn(d, EYE_L, EYE_R)
    mouth_fn(d)
    if extra_fn:
        extra_fn(d)
    out.save(os.path.join(OUT_DIR, f"girl_{name}.png"), "PNG")
    
    print(f"  {name}")

print("\nGenerating boy + girl expressions...")

# 01: happy (normal eyes, smile) - copying base but adding features
process("01_happy", normal_eyes, smile)

# 02-14: various expressions
process("02_wink", wink_eyes, wink_mouth)
process("03_hearteyes", heart_eyes, heart_mouth)
process("04_surprised", surprised_eyes, surprised_mouth)
process("05_shy", shy_eyes, shy_mouth, sweat)
process("06_laughing", laugh_eyes, laugh_mouth)
process("07_cool", cool_eyes, cool_mouth)
process("08_thinking", think_eyes, smile, question)
process("09_sleepy", sleepy_eyes, sleepy_mouth, zzz)
process("10_angry", angry_eyes, angry_mouth)
process("11_party", normal_eyes, smile, lambda d: (party_hat(d), confetti(d)))
process("12_proud", laugh_eyes, smile)

print(f"\nDone! 24 icons saved to {OUT_DIR}/")
