import os, sys
from PIL import Image, ImageFilter

src_path, res = sys.argv[1], sys.argv[2]
src = Image.open(src_path).convert('RGBA')

def sharp(img, n):
    return img.resize((n, n), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=0.8, percent=75, threshold=1))

# legacy launcher icons: the whole picture, full size
for d, s in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    folder = os.path.join(res, 'mipmap-' + d)
    os.makedirs(folder, exist_ok=True)
    icon = sharp(src, s).convert('RGBA')
    icon.save(os.path.join(folder, 'ic_launcher.png'))
    icon.save(os.path.join(folder, 'ic_launcher_round.png'))

# adaptive foreground: the picture sits in the centre, 72 of 108 units
for d, s in [('mdpi', 108), ('hdpi', 162), ('xhdpi', 216), ('xxhdpi', 324), ('xxxhdpi', 432)]:
    folder = os.path.join(res, 'mipmap-' + d)
    os.makedirs(folder, exist_ok=True)
    inner = round(s * 72 / 108)
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    canvas.paste(sharp(src, inner), ((s - inner) // 2, (s - inner) // 2))
    canvas.save(os.path.join(folder, 'ic_launcher_foreground.png'))

# opening screen: plain frame colour, and the picture in the centre for the Android 12+ splash icon
for d in ['drawable', 'drawable-port', 'drawable-land']:
    folder = os.path.join(res, d)
    os.makedirs(folder, exist_ok=True)
    Image.new('RGB', (1080, 1920), (0xAE, 0xAA, 0x48)).save(os.path.join(folder, 'splash.png'))
splash = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
inner = sharp(src, 680)
splash.paste(inner, ((1024 - 680) // 2, (1024 - 680) // 2), inner)
os.makedirs(os.path.join(res, 'drawable'), exist_ok=True)
splash.save(os.path.join(res, 'drawable', 'splash_icon.png'))
print('icons made')
