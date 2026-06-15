import cv2
import numpy as np

def test_omr(image_path):
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 1. Edge detection
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    
    # 2. Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Find largest contour (the table)
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
        print(f"[{image_path}] Found table contour: {doc_cnt.shape}")
        
        # Draw contour
        cv2.drawContours(img, [doc_cnt], -1, (0, 255, 0), 3)
        cv2.imwrite(f"debug_{image_path}", img)
    else:
        print(f"[{image_path}] Table contour NOT found")

if __name__ == '__main__':
    test_omr('test_omr-1.png')
    test_omr('test_omr-2.png')
    test_omr('test_omr-3.png')
