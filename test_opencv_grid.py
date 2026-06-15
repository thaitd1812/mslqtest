import cv2
import numpy as np

def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)] # Top-left
    rect[2] = pts[np.argmax(s)] # Bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # Top-right
    rect[3] = pts[np.argmax(diff)] # Bottom-left
    return rect

def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))

    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))

    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped, maxWidth, maxHeight

def test_omr_grid(image_path):
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    doc_cnt = None
    if contours:
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        for c in contours:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) == 4:
                doc_cnt = approx
                break
                
    if doc_cnt is not None:
        # Warp
        warped, w, h = four_point_transform(img, doc_cnt.reshape(4, 2))
        print(f"[{image_path}] Table size: {w} x {h}")
        warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        
        # Adaptive thresholding
        thresh = cv2.adaptiveThreshold(warped_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 10)
        
        # Horizontal projection to find row lines
        row_sums = np.sum(thresh, axis=1) / 255.0
        
        # Smooth the projection slightly
        kernel = np.ones(3) / 3
        row_sums_smooth = np.convolve(row_sums, kernel, mode='same')
        
        # Find peaks where the sum is greater than, say, 20% of the width
        peak_threshold = w * 0.2
        is_peak = row_sums_smooth > peak_threshold
        
        # Group contiguous peak pixels into a single y-coordinate
        y_coords = []
        in_peak = False
        peak_start = 0
        for y in range(len(is_peak)):
            if is_peak[y] and not in_peak:
                in_peak = True
                peak_start = y
            elif not is_peak[y] and in_peak:
                in_peak = False
                y_coords.append((peak_start + y) // 2)
        if in_peak:
            y_coords.append((peak_start + len(is_peak)) // 2)
            
        print(f"[{image_path}] Found {len(y_coords) - 1} rows via projection.")
        
        # Slice into rows
        for i in range(1, len(y_coords)):
            y_start = y_coords[i-1]
            y_end = y_coords[i]
            row_img = warped[y_start:y_end, :]
            row_thresh = thresh[y_start:y_end, :]
            
            # The columns 1, 2, 3, 4, 5 are located at specific percentages:
            # 0.8 + 8.4 = 9.2 -> 9.2/13.3 = 0.6917
            # Let's check chunks
            H, W = row_thresh.shape
            
            cols = [
                (0.6917, 0.7533),
                (0.7533, 0.8150),
                (0.8150, 0.8766),
                (0.8766, 0.9383),
                (0.9383, 1.0000)
            ]
            
            densities = []
            for (start_pct, end_pct) in cols:
                x_start = int(start_pct * W)
                x_end = int(end_pct * W)
                cell = row_thresh[:, x_start:x_end]
                
                # Exclude borders: chop 10% off each side of the cell
                cell_h, cell_w = cell.shape
                inner_cell = cell[int(cell_h*0.1):int(cell_h*0.9), int(cell_w*0.1):int(cell_w*0.9)]
                
                total_pixels = inner_cell.shape[0] * inner_cell.shape[1]
                if total_pixels == 0:
                    density = 0
                else:
                    black_pixels = cv2.countNonZero(inner_cell)
                    density = black_pixels / total_pixels
                densities.append(density)
            
            chosen = np.argmax(densities) + 1
            max_d = max(densities)
            print(f"  Row {i} -> Chosen: {chosen} (max_d: {max_d:.2f}, densities: {[f'{d:.2f}' for d in densities]})")

if __name__ == '__main__':
    test_omr_grid('test_omr-1.png')
    test_omr_grid('test_omr-2.png')
    test_omr_grid('test_omr-3.png')
