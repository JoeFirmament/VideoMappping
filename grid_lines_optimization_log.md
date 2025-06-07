# 单应性矩阵绿色网格线优化日志

## 优化时间
2024年12月19日

## 问题描述
用户反馈：前端在单应性矩阵显示的标定后的绿色线，覆盖范围太小，不够明显。

## 原始显示逻辑分析

### 触发条件
- 必须已完成单应性矩阵标定：`homographyMapper_.isCalibrated()`
- 必须有至少4个标定点：`points.size() >= 4`
- 在标定模式下：`calibrationMode_`

### 绘制位置
**文件**: `src/VideoStreamer.cpp:675-725` 的 `drawCalibrationPoints()` 方法

### 原始参数
```cpp
int gridSize = 50;     // 网格大小（地面坐标系中50单位）
int gridCount = 10;    // 网格数量（最多10条线）
int lineThickness = 1; // 线条粗细（1像素）
cv::Scalar color = cv::Scalar(0, 255, 0); // 绿色
```

### 原始覆盖范围
- **限制**：仅在标定点的边界框内绘制
- **计算方式**：
  ```cpp
  // 找到标定点的最小/最大坐标
  for (const auto& point : points) {
      minX = std::min(minX, point.second.x);
      minY = std::min(minY, point.second.y);
      maxX = std::max(maxX, point.second.x);
      maxY = std::max(maxY, point.second.y);
  }
  ```

## 优化改进 ✅

### 1. 增加网格密度
```cpp
// 优化前
int gridSize = 50;     // 网格间距50单位
int gridCount = 10;    // 最多10条线

// 优化后
int gridSize = 25;     // 网格间距25单位（密度翻倍）
int gridCount = 20;    // 最多20条线（覆盖范围翻倍）
```

### 2. 扩展覆盖范围
```cpp
// 🔧 新增：扩展边界框，增加覆盖范围
float expandRatio = 0.5f; // 向外扩展50%
float rangeX = maxX - minX;
float rangeY = maxY - minY;
minX -= rangeX * expandRatio;
maxX += rangeX * expandRatio;
minY -= rangeY * expandRatio;
maxY += rangeY * expandRatio;
```

### 3. 增强线条可见性
```cpp
// 优化前
cv::line(frame, start, end, cv::Scalar(0, 255, 0), 1);

// 优化后
cv::line(frame, start, end, cv::Scalar(0, 255, 0), 2, cv::LINE_AA);
// - 线条粗细从1像素增加到2像素
// - 添加抗锯齿效果（cv::LINE_AA）
```

### 4. 优化坐标标记
```cpp
// 优化前：每条线都显示坐标
cv::putText(frame, std::to_string(int(y)), 
           cv::Point(start.x + 5, start.y), 
           cv::FONT_HERSHEY_SIMPLEX, 0.3, cv::Scalar(0, 255, 0), 1);

// 优化后：只在偶数线显示坐标，避免拥挤
if (i % 2 == 0) {
    cv::putText(frame, std::to_string(int(y)), 
               cv::Point(std::max(5.0f, start.x + 5), std::max(15.0f, start.y)), 
               cv::FONT_HERSHEY_SIMPLEX, 0.4, cv::Scalar(0, 255, 0), 1, cv::LINE_AA);
}
```

### 5. 添加边界检查
```cpp
// 🔧 新增：检查线条是否在图像范围内
if ((start.x >= 0 || end.x >= 0) && (start.x < frame.cols || end.x < frame.cols) &&
    (start.y >= 0 || end.y >= 0) && (start.y < frame.rows || end.y < frame.rows)) {
    // 只绘制在图像范围内的线条
    cv::line(frame, start, end, cv::Scalar(0, 255, 0), 2, cv::LINE_AA);
}
```

## 优化效果对比

### 优化前
- **网格密度**: 50单位间距，稀疏
- **覆盖范围**: 仅限标定点边界框
- **线条粗细**: 1像素，不够明显
- **坐标标记**: 每条线都有，显得拥挤
- **边界处理**: 无检查，可能绘制到图像外

### 优化后
- **网格密度**: 25单位间距，密度翻倍
- **覆盖范围**: 向外扩展50%，覆盖更大区域
- **线条粗细**: 2像素 + 抗锯齿，更加明显
- **坐标标记**: 只在偶数线显示，清晰不拥挤
- **边界处理**: 智能检查，只绘制有效区域

## 预期改进效果

1. **可见性提升**: 线条更粗、更清晰
2. **覆盖范围扩大**: 比原来大50%的显示区域
3. **网格密度增加**: 更精细的网格划分
4. **性能优化**: 边界检查避免无效绘制
5. **视觉体验**: 坐标标记更清晰，不拥挤

## 调试验证

### 验证步骤
1. 完成单应性矩阵标定（至少4个点）
2. 观察绿色网格线的显示效果
3. 检查网格线是否覆盖更大范围
4. 验证线条是否更加明显
5. 确认坐标标记是否清晰

### 日志输出
```bash
# 在标定完成后，观察控制台输出
📐 [COORDINATE CALIBRATION] 标定模式: 启用
✅ [HOMOGRAPHY] 单应性矩阵计算成功
```

## 相关文件
- `src/VideoStreamer.cpp:675-725` - 网格线绘制逻辑
- `src/HomographyMapper.cpp:510-544` - 基础网格绘制方法

## 版本标记
- **优化版本**: v2.3-grid-lines-enhancement
- **Git提交**: "enhance: improve grid lines visibility and coverage for homography calibration"

## 未来改进建议
1. 添加网格线颜色配置选项
2. 支持动态调整网格密度
3. 添加网格线透明度控制
4. 支持不同的网格样式（虚线、点线等） 