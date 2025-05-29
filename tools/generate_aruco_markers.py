#!/usr/bin/env python3
import cv2
import numpy as np
import argparse
import os

def generate_aruco_marker(dictionary_name, marker_id, size, output_dir="."):
    """生成 ArUco 标记并保存为 PNG 文件
    
    Args:
        dictionary_name: ArUco 字典名称，如 'DICT_4X4_50'
        marker_id: 标记 ID，从 0 开始
        size: 生成的标记图像尺寸（像素）
        output_dir: 输出目录
    """
    # 选择 ArUco 字典
    ARUCO_DICT = {
        "DICT_4X4_50": cv2.aruco.DICT_4X4_50,
        "DICT_4X4_100": cv2.aruco.DICT_4X4_100,
        "DICT_5X5_50": cv2.aruco.DICT_5X5_50,
        "DICT_5X5_100": cv2.aruco.DICT_5X5_100,
        "DICT_6X6_50": cv2.aruco.DICT_6X6_50,
        "DICT_6X6_100": cv2.aruco.DICT_6X6_100,
        "DICT_7X7_50": cv2.aruco.DICT_7X7_50,
        "DICT_7X7_100": cv2.aruco.DICT_7X7_100
    }
    
    # 验证字典名称
    if dictionary_name not in ARUCO_DICT:
        print(f"Error: 不支持的字典 {dictionary_name}")
        print(f"可用的字典: {', '.join(ARUCO_DICT.keys())}")
        return False
    
    # 创建字典对象
    aruco_dict = cv2.aruco.Dictionary_get(ARUCO_DICT[dictionary_name])
    
    # 生成标记
    marker_image = np.zeros((size, size), dtype=np.uint8)
    marker_image = cv2.aruco.drawMarker(aruco_dict, marker_id, size, marker_image, 1)
    
    # 添加白色边距（标记周围的空白区域）
    border_size = size // 10  # 边距为标记尺寸的 10%
    bordered_image = np.ones((size + 2 * border_size, size + 2 * border_size), dtype=np.uint8) * 255
    bordered_image[border_size:border_size+size, border_size:border_size+size] = marker_image
    
    # 添加标记 ID 文本
    final_image = cv2.cvtColor(bordered_image, cv2.COLOR_GRAY2BGR)
    cv2.putText(final_image, f"ID: {marker_id}", (border_size, size + border_size * 2 - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
    
    # 创建输出目录（如果不存在）
    os.makedirs(output_dir, exist_ok=True)
    
    # 保存标记图像
    filename = f"{output_dir}/aruco_{dictionary_name}_id{marker_id}_{size}px.png"
    cv2.imwrite(filename, final_image)
    print(f"标记已保存到: {filename}")
    
    return True

def main():
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='ArUco 标记生成器')
    parser.add_argument('--dict', type=str, default='DICT_4X4_50',
                        help='ArUco 字典名称 (default: DICT_4X4_50)')
    parser.add_argument('--id', type=int, default=0,
                        help='标记 ID (default: 0)')
    parser.add_argument('--size', type=int, default=200,
                        help='标记尺寸（像素） (default: 200)')
    parser.add_argument('--output', type=str, default='.',
                        help='输出目录 (default: 当前目录)')
    parser.add_argument('--batch', action='store_true',
                        help='批量生成标记（从 0 到 --id）')
    
    args = parser.parse_args()
    
    if args.batch:
        # 批量生成标记
        for i in range(args.id + 1):
            generate_aruco_marker(args.dict, i, args.size, args.output)
    else:
        # 生成单个标记
        generate_aruco_marker(args.dict, args.id, args.size, args.output)

if __name__ == "__main__":
    main()
