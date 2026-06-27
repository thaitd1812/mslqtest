import fitz
import cv2
import numpy as np
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), 'worker'))
from omr import _find_corner_markers, _warp_canonical, _cluster_1d, ANSWER_X_MIN

fname = "latex_prototype/omr_sheet.pdf"
doc = fitz.open(fname)
page = doc[0]
pix = page.get_pixmap(dpi=150)
img_bytes = pix.tobytes("jpeg")
nparr = np.frombuffer(img_bytes, np.uint8)
img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
found, areas = _find_corner_markers(gray)
warped = _warp_canonical(img, found, areas)
wg = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

circles = cv2.HoughCircles(wg, cv2.HOUGH_GRADIENT, dp=1, minDist=18,
                            param1=120, param2=22, minRadius=8, maxRadius=20)
pts = [(float(x), float(y)) for (x, y, r) in circles[0] if x > ANSWER_X_MIN]
col_groups = [g for g in _cluster_1d([p[0] for p in pts], 25) if len(g) >= 3]
cols = sorted(float(np.mean(g)) for g in col_groups)
print(f"CLEAN PDF COLS: {cols}")

fname = "omr_sheet.pdf"
doc = fitz.open(fname)
page = doc[1] # Page 2 has lots of clear circles
pix = page.get_pixmap(dpi=150)
img_bytes = pix.tobytes("jpeg")
nparr = np.frombuffer(img_bytes, np.uint8)
img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
found, areas = _find_corner_markers(gray)
warped = _warp_canonical(img, found, areas)
wg = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

circles = cv2.HoughCircles(wg, cv2.HOUGH_GRADIENT, dp=1, minDist=18,
                            param1=120, param2=22, minRadius=8, maxRadius=20)
pts = [(float(x), float(y)) for (x, y, r) in circles[0] if x > ANSWER_X_MIN]
col_groups = [g for g in _cluster_1d([p[0] for p in pts], 25) if len(g) >= 3]
cols = sorted(float(np.mean(g)) for g in col_groups)
print(f"USER PDF COLS: {cols}")
