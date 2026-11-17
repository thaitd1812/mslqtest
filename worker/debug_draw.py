import cv2
import numpy as np
import fitz
from omr import _find_corner_markers, _warp_canonical, _detect_grid

doc = fitz.open("/Users/admin/Documents/thaitd/Code/chambaionline/user_upload.pdf")
page = doc[0]
pix = page.get_pixmap(dpi=150)
nparr = np.frombuffer(pix.tobytes("jpeg"), np.uint8)
img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
found, areas = _find_corner_markers(gray)
warped = _warp_canonical(img, found, areas)
wg = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)

cols, rows, q_start = _detect_grid(wg, 0)

debug_img = warped.copy()
r = 12
for ry in rows:
    cv2.line(debug_img, (0, int(ry)), (1000, int(ry)), (255, 0, 0), 1)
    for cx in cols:
        cv2.rectangle(debug_img, (int(cx-r), int(ry-r)), (int(cx+r), int(ry+r)), (0, 0, 255), 2)
        
cv2.imwrite("debug_omr.jpg", debug_img)
