#!/usr/bin/env python3
"""
ArUco标记A4打印生成器
为A4纸打印优化，生成大尺寸、高对比度的标记
"""
import cv2
import numpy as np
import argparse
import os

def generate_a4_aruco_marker(marker_id, output_dir="aruco_a4", dpi=300):
    """生成适合A4纸打印的ArUco标记
    
    Args:
        marker_id: 标记ID
        output_dir: 输出目录
        dpi: 打印分辨率（DPI）
    """
    # A4纸尺寸：210mm x 297mm
    # 标记尺寸：150mm x 150mm（居中，留出边距）
    marker_size_mm = 150
    marker_size_px = int(marker_size_mm * dpi / 25.4)  # 转换为像素
    
    # A4纸像素尺寸
    a4_width_px = int(210 * dpi / 25.4)
    a4_height_px = int(297 * dpi / 25.4)
    
    print(f"生成标记 ID {marker_id}:")
    print(f"  A4纸尺寸: {a4_width_px} x {a4_height_px} 像素")
    print(f"  标记尺寸: {marker_size_px} x {marker_size_px} 像素 ({marker_size_mm}mm)")
    print(f"  打印DPI: {dpi}")
    
    # 创建ArUco字典（与主程序一致）
    aruco_dict = cv2.aruco.Dictionary_get(cv2.aruco.DICT_4X4_50)
    
    # 生成标记
    marker_image = np.zeros((marker_size_px, marker_size_px), dtype=np.uint8)
    marker_image = cv2.aruco.drawMarker(aruco_dict, marker_id, marker_size_px, marker_image, 1)
    
    # 创建A4白色背景
    a4_image = np.ones((a4_height_px, a4_width_px), dtype=np.uint8) * 255
    
    # 将标记居中放置
    start_x = (a4_width_px - marker_size_px) // 2
    start_y = (a4_height_px - marker_size_px) // 2
    a4_image[start_y:start_y+marker_size_px, start_x:start_x+marker_size_px] = marker_image
    
    # 转换为彩色图像以添加文本
    final_image = cv2.cvtColor(a4_image, cv2.COLOR_GRAY2BGR)
    
    # 添加标记信息文本
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 2.0
    thickness = 3
    color = (0, 0, 0)  # 黑色
    
    # 顶部标题
    title_text = f"ArUco Marker - ID: {marker_id}"
    title_size = cv2.getTextSize(title_text, font, font_scale, thickness)[0]
    title_x = (a4_width_px - title_size[0]) // 2
    cv2.putText(final_image, title_text, (title_x, 100), font, font_scale, color, thickness)
    
    # 底部信息
    info_texts = [
        f"Dictionary: DICT_4X4_50",
        f"Size: {marker_size_mm}mm x {marker_size_mm}mm",
        f"Print DPI: {dpi}",
        f"For VideoMapping System"
    ]
    
    info_font_scale = 1.0
    info_thickness = 2
    line_height = 50
    
    for i, text in enumerate(info_texts):
        text_size = cv2.getTextSize(text, font, info_font_scale, info_thickness)[0]
        text_x = (a4_width_px - text_size[0]) // 2
        text_y = a4_height_px - 200 + i * line_height
        cv2.putText(final_image, text, (text_x, text_y), font, info_font_scale, color, info_thickness)
    
    # 添加标定点参考线（可选）
    # 在标记四角添加小十字，方便手动对齐
    cross_size = 20
    cross_thickness = 2
    cross_color = (128, 128, 128)  # 灰色
    
    corners = [
        (start_x, start_y),  # 左上
        (start_x + marker_size_px, start_y),  # 右上
        (start_x, start_y + marker_size_px),  # 左下
        (start_x + marker_size_px, start_y + marker_size_px)  # 右下
    ]
    
    for corner_x, corner_y in corners:
        # 绘制十字参考线
        cv2.line(final_image, 
                (corner_x - cross_size, corner_y), 
                (corner_x + cross_size, corner_y), 
                cross_color, cross_thickness)
        cv2.line(final_image, 
                (corner_x, corner_y - cross_size), 
                (corner_x, corner_y + cross_size), 
                cross_color, cross_thickness)
    
    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    
    # 保存高质量PNG文件
    filename = f"{output_dir}/ArUco_ID{marker_id:02d}_A4_{dpi}dpi.png"
    # 使用高质量压缩参数
    cv2.imwrite(filename, final_image, [cv2.IMWRITE_PNG_COMPRESSION, 0])
    
    print(f"  已保存: {filename}")
    print(f"  文件大小: {os.path.getsize(filename) / 1024 / 1024:.1f} MB")
    
    return filename

def main():
    parser = argparse.ArgumentParser(description='ArUco标记A4打印生成器')
    parser.add_argument('--id', type=int, default=0, help='标记ID (default: 0)')
    parser.add_argument('--batch', action='store_true', help='批量生成标记（从0到--id）')
    parser.add_argument('--dpi', type=int, default=300, help='打印DPI (default: 300)')
    parser.add_argument('--output', type=str, default='aruco_a4', help='输出目录')
    
    args = parser.parse_args()
    
    print("=== ArUco标记A4打印生成器 ===")
    print(f"输出目录: {args.output}")
    print(f"打印DPI: {args.dpi}")
    print()
    
    if args.batch:
        print(f"批量生成标记 ID 0 到 {args.id}...")
        for i in range(args.id + 1):
            generate_a4_aruco_marker(i, args.output, args.dpi)
            print()
    else:
        print(f"生成单个标记 ID {args.id}...")
        generate_a4_aruco_marker(args.id, args.output, args.dpi)
    
    print("生成完成！")
    print("\n打印建议:")
    print("1. 使用激光打印机或高质量喷墨打印机")
    print("2. 选择'实际尺寸'或'100%'缩放打印")
    print("3. 使用白色A4纸，确保对比度")
    print("4. 打印后检查标记是否清晰完整")

if __name__ == "__main__":
    main() 