from PIL import Image, ImageDraw, ImageFilter
import os
import math

def create_icon(size=512):
    # Supersampling factor for ultra-sharp edges
    scale = 2
    dim = size * scale
    img = Image.new('RGBA', (dim, dim), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Center and bounds
    pad = int(dim * 0.08)
    rect = [pad, pad, dim - pad, dim - pad]
    radius = int(dim * 0.24)

    # 1. Outer Glow / Shadow
    glow = Image.new('RGBA', (dim, dim), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(rect, radius=radius, fill=(56, 189, 248, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(dim * 0.04)))
    img.paste(glow, (0, 0), glow)

    # 2. Base Squircle (Deep obsidian gradient)
    mask = Image.new('L', (dim, dim), 0)
    ImageDraw.Draw(mask).rounded_rectangle(rect, radius=radius, fill=255)

    base = Image.new('RGBA', (dim, dim), (0, 0, 0, 0))
    base_draw = ImageDraw.Draw(base)
    for y in range(rect[1], rect[3]):
        ratio = (y - rect[1]) / (rect[3] - rect[1])
        # Dark tech navy to midnight slate
        r = int(10 + ratio * 8)
        g = int(18 + ratio * 15)
        b = int(35 + ratio * 30)
        base_draw.line([(rect[0], y), (rect[2], y)], fill=(r, g, b, 255))

    img.paste(base, (0, 0), mask)

    # 3. High-tech border rim
    border_draw = ImageDraw.Draw(img)
    border_width = max(2, int(dim * 0.025))
    border_draw.rounded_rectangle(rect, radius=radius, outline=(56, 189, 248, 220), width=border_width)

    # 4. Acceleration Speed Chevrons / Downward Arrow
    cx = dim / 2
    cy = dim / 2

    arrow_img = Image.new('RGBA', (dim, dim), (0, 0, 0, 0))
    arrow_draw = ImageDraw.Draw(arrow_img)

    # Modern high-speed arrow points
    # Shaft
    shaft_w = int(dim * 0.16)
    shaft_top = int(dim * 0.22)
    shaft_bottom = int(dim * 0.52)
    arrow_draw.rounded_rectangle(
        [cx - shaft_w / 2, shaft_top, cx + shaft_w / 2, shaft_bottom],
        radius=int(shaft_w * 0.3),
        fill=(14, 165, 233, 255)
    )

    # Arrowhead (Downward triangle)
    head_w = int(dim * 0.54)
    head_top = int(dim * 0.44)
    head_tip = int(dim * 0.68)
    head_poly = [
        (cx - head_w / 2, head_top),
        (cx + head_w / 2, head_top),
        (cx, head_tip)
    ]
    arrow_draw.polygon(head_poly, fill=(56, 189, 248, 255))

    # Base Bracket Tray (representing receiving / downloaded file)
    tray_y = int(dim * 0.72)
    tray_h = int(dim * 0.08)
    tray_w = int(dim * 0.56)
    tray_lip = int(dim * 0.12)
    tray_thick = int(dim * 0.04)

    # Horizontal bottom bar
    arrow_draw.rounded_rectangle(
        [cx - tray_w / 2, tray_y, cx + tray_w / 2, tray_y + tray_thick],
        radius=int(tray_thick * 0.4),
        fill=(56, 189, 248, 240)
    )
    # Left lip
    arrow_draw.rounded_rectangle(
        [cx - tray_w / 2, tray_y - tray_lip, cx - tray_w / 2 + tray_thick, tray_y + tray_thick],
        radius=int(tray_thick * 0.4),
        fill=(56, 189, 248, 240)
    )
    # Right lip
    arrow_draw.rounded_rectangle(
        [cx + tray_w / 2 - tray_thick, tray_y - tray_lip, cx + tray_w / 2, tray_y + tray_thick],
        radius=int(tray_thick * 0.4),
        fill=(56, 189, 248, 240)
    )

    # Speed accent flashes on the side
    flash_w = int(dim * 0.07)
    flash_h = int(dim * 0.025)
    # Left flashes
    arrow_draw.rounded_rectangle([cx - int(dim * 0.38), cy - int(dim * 0.12), cx - int(dim * 0.38) + flash_w, cy - int(dim * 0.12) + flash_h], radius=2, fill=(56, 189, 248, 180))
    arrow_draw.rounded_rectangle([cx - int(dim * 0.34), cy - int(dim * 0.04), cx - int(dim * 0.34) + flash_w, cy - int(dim * 0.04) + flash_h], radius=2, fill=(56, 189, 248, 220))
    # Right flashes
    arrow_draw.rounded_rectangle([cx + int(dim * 0.38) - flash_w, cy - int(dim * 0.12), cx + int(dim * 0.38), cy - int(dim * 0.12) + flash_h], radius=2, fill=(56, 189, 248, 180))
    arrow_draw.rounded_rectangle([cx + int(dim * 0.34) - flash_w, cy - int(dim * 0.04), cx + int(dim * 0.34), cy - int(dim * 0.04) + flash_h], radius=2, fill=(56, 189, 248, 220))

    img.paste(arrow_img, (0, 0), arrow_img)

    return img

def main():
    out_dir = os.path.join(os.getcwd(), 'extension', 'icons')
    os.makedirs(out_dir, exist_ok=True)

    master = create_icon(size=512)

    sizes = [16, 32, 48, 128]
    for s in sizes:
        resized = master.resize((s, s), Image.Resampling.LANCZOS)
        out_path = os.path.join(out_dir, f'icon{s}.png')
        resized.save(out_path, format='PNG')
        print(f"Generated: {out_path} ({s}x{s})")

    # Also save a 32px and 512px icon for public/web app
    public_dir = os.path.join(os.getcwd(), 'public')
    os.makedirs(public_dir, exist_ok=True)
    master.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'vite.svg'), format='PNG')
    master.resize((128, 128), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'logo.png'), format='PNG')

if __name__ == '__main__':
    main()
