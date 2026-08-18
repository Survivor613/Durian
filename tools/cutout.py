"""把白底素材图去底+裁剪成透明 PNG。用法: python tools/cutout.py <输入> <输出>"""
import sys
from collections import deque
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGBA")
w, h = img.size
px = img.load()

TOL = 48  # 与纯白的容差（连浅灰投影也一起去掉）

def is_white(p):
    r, g, b, a = p
    return a == 0 or (r > 255 - TOL and g > 255 - TOL and b > 255 - TOL)

# 从四周边缘洪水填充，把连通的白色背景标记为透明
seen = bytearray(w * h)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if is_white(px[x, y]) and not seen[y * w + x]:
            seen[y * w + x] = 1
            q.append((x, y))
for y in range(h):
    for x in (0, w - 1):
        if is_white(px[x, y]) and not seen[y * w + x]:
            seen[y * w + x] = 1
            q.append((x, y))
while q:
    x, y = q.popleft()
    px[x, y] = (0, 0, 0, 0)
    for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_white(px[nx, ny]):
            seen[ny * w + nx] = 1
            q.append((nx, ny))

# 边缘清理（迭代多轮，逐步啃掉白边）：
# 1) 与透明相邻的半白像素按白度降低透明度
# 2) 被透明包围的孤立噪点直接清除
for _ in range(4):
    alpha = [[px[x, y][3] for x in range(w)] for y in range(h)]
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            transparent_neighbors = sum(
                1 for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1),(x+1,y+1),(x-1,y-1),(x+1,y-1),(x-1,y+1))
                if 0 <= nx < w and 0 <= ny < h and alpha[ny][nx] == 0
            )
            if transparent_neighbors >= 6:
                px[x, y] = (0, 0, 0, 0)
            elif transparent_neighbors > 0:
                whiteness = min(r, g, b)
                if whiteness > 160:
                    px[x, y] = (r, g, b, int(a * (255 - whiteness) / 95))

bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)
img.save(dst)
print(f"{dst}: {img.size[0]}x{img.size[1]}")
