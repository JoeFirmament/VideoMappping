#!/bin/bash

# 相机标定后图片处理脚本
# 作者: VideoMapping System
# 用法: ./cleanup_calibration.sh [excellent|good|poor|backup]

CALIB_DIR="calibration_images"
BACKUP_DIR="calibration_backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 统计当前图片数量
IMAGE_COUNT=$(ls $CALIB_DIR/calib_*.jpg 2>/dev/null | wc -l)
echo "当前标定图片数量: $IMAGE_COUNT"

case "$1" in
    "excellent")
        echo "=== 处理优秀标定结果 (误差 < 1.0 像素) ==="
        
        # 备份所有图片
        BACKUP_SUBDIR="$BACKUP_DIR/excellent_$TIMESTAMP"
        mkdir -p "$BACKUP_SUBDIR"
        cp $CALIB_DIR/calib_*.jpg "$BACKUP_SUBDIR/" 2>/dev/null
        echo "已备份 $IMAGE_COUNT 张图片到: $BACKUP_SUBDIR"
        
        # 清理当前目录
        rm $CALIB_DIR/calib_*.jpg 2>/dev/null
        echo "已清理当前标定图片，为下次标定做准备"
        
        # 保留少量代表性图片用于快速验证
        if [ $IMAGE_COUNT -gt 10 ]; then
            for i in 1 $(($IMAGE_COUNT/4)) $(($IMAGE_COUNT/2)) $(($IMAGE_COUNT*3/4)) $IMAGE_COUNT; do
                if [ -f "$BACKUP_SUBDIR/calib_$i.jpg" ]; then
                    cp "$BACKUP_SUBDIR/calib_$i.jpg" "$CALIB_DIR/"
                fi
            done
            echo "保留了 5 张代表性图片用于验证"
        fi
        ;;
        
    "good")
        echo "=== 处理良好标定结果 (误差 1.0-2.0 像素) ==="
        
        # 备份所有图片
        BACKUP_SUBDIR="$BACKUP_DIR/good_$TIMESTAMP"
        mkdir -p "$BACKUP_SUBDIR"
        cp $CALIB_DIR/calib_*.jpg "$BACKUP_SUBDIR/" 2>/dev/null
        echo "已备份 $IMAGE_COUNT 张图片到: $BACKUP_SUBDIR"
        
        # 保留质量较好的图片（每隔几张保留一张）
        rm $CALIB_DIR/calib_*.jpg 2>/dev/null
        
        # 选择性恢复图片（保留间隔更大的图片，减少相似图片）
        step=$((IMAGE_COUNT / 25 + 1))  # 目标保留约25张图片
        count=0
        for i in $(seq 1 $step $IMAGE_COUNT); do
            if [ -f "$BACKUP_SUBDIR/calib_$i.jpg" ]; then
                cp "$BACKUP_SUBDIR/calib_$i.jpg" "$CALIB_DIR/"
                count=$((count + 1))
            fi
        done
        echo "已选择性保留 $count 张质量较好的图片"
        echo "建议检查标定参数后重新标定"
        ;;
        
    "poor")
        echo "=== 处理较差标定结果 (误差 > 2.0 像素) ==="
        
        # 备份到问题目录
        BACKUP_SUBDIR="$BACKUP_DIR/poor_$TIMESTAMP"
        mkdir -p "$BACKUP_SUBDIR"
        cp $CALIB_DIR/calib_*.jpg "$BACKUP_SUBDIR/" 2>/dev/null
        echo "已备份问题图片到: $BACKUP_SUBDIR"
        
        # 完全清理
        rm $CALIB_DIR/calib_*.jpg 2>/dev/null
        echo "已清理所有标定图片"
        echo ""
        echo "建议重新采集时注意:"
        echo "1. 确保棋盘格完全平整，无弯曲"
        echo "2. 避免过度倾斜角度 (< 45度)"
        echo "3. 确保光照均匀，避免反光和阴影"
        echo "4. 棋盘格要覆盖整个视野的不同区域"
        echo "5. 保持适当距离，确保棋盘格清晰可见"
        ;;
        
    "backup")
        echo "=== 仅备份当前标定图片 ==="
        BACKUP_SUBDIR="$BACKUP_DIR/manual_$TIMESTAMP"
        mkdir -p "$BACKUP_SUBDIR"
        cp $CALIB_DIR/calib_*.jpg "$BACKUP_SUBDIR/" 2>/dev/null
        echo "已备份 $IMAGE_COUNT 张图片到: $BACKUP_SUBDIR"
        echo "原图片保持不变"
        ;;
        
    *)
        echo "相机标定后图片处理脚本"
        echo ""
        echo "用法: $0 [选项]"
        echo ""
        echo "选项:"
        echo "  excellent  - 优秀标定结果 (误差 < 1.0 像素)"
        echo "               备份所有图片，清理目录，保留少量验证图片"
        echo ""
        echo "  good       - 良好标定结果 (误差 1.0-2.0 像素)"
        echo "               备份所有图片，选择性保留质量好的图片"
        echo ""
        echo "  poor       - 较差标定结果 (误差 > 2.0 像素)"
        echo "               备份问题图片，完全清理，建议重新采集"
        echo ""
        echo "  backup     - 仅备份图片，不做其他操作"
        echo ""
        echo "当前状态:"
        echo "  标定图片数量: $IMAGE_COUNT"
        if [ $IMAGE_COUNT -gt 0 ]; then
            echo "  最新图片: $(ls $CALIB_DIR/calib_*.jpg 2>/dev/null | tail -1)"
            echo "  目录大小: $(du -sh $CALIB_DIR 2>/dev/null | cut -f1)"
        fi
        ;;
esac

echo ""
echo "备份目录: $BACKUP_DIR"
ls -la "$BACKUP_DIR" 2>/dev/null | tail -5 