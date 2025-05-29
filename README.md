# VideoMapping

视频映射应用程序，用于实时视频流的坐标映射和标定。

## 功能特点

- 实时视频流显示
- 手动标定功能（图像坐标到地面坐标的映射）
- 坐标转换功能（图像坐标到地面坐标的转换）
- 支持直角坐标系和极坐标系
- 标定结果保存和加载

## 系统要求

- Linux 操作系统
- OpenCV 库
- Crow 框架（C++ Web 框架）
- 现代网络浏览器

## 安装指南

1. 克隆仓库：
   ```bash
   git clone https://github.com/JoeFirmament/VideoMappping.git
   cd VideoMapping
   ```

2. 编译项目：
   ```bash
   mkdir -p build
   cd build
   cmake ..
   make
   ```

3. 运行应用程序：
   ```bash
   ./video_mapping
   ```

4. 在浏览器中访问：
   ```
   http://localhost:8080
   ```

## 使用方法

### 视频流控制
- 点击"开始流"按钮开始视频流
- 点击"停止流"按钮停止视频流
- 点击"全屏"按钮进入全屏模式

### 标定功能
1. 点击"进入标定模式"按钮
2. 在地面 X 和地面 Y 输入框中输入坐标值
3. 点击视频画面添加标定点（至少需要 4 个点）
4. 点击"计算单应性矩阵"按钮进行标定
5. 标定完成后，可以点击"保存标定结果"按钮保存标定结果

### 坐标转换
1. 标定完成后，点击视频画面上的任意点
2. 应用程序会自动计算并显示对应的地面坐标

## 项目结构

- `src/`: 源代码文件
  - `main.cpp`: 主程序入口
  - `VideoStreamer.cpp`: 视频流处理类
  - `HomographyMapper.cpp`: 单应性矩阵计算和坐标转换类
- `include/`: 头文件
- `static/`: 静态文件（HTML、CSS、JavaScript）
- `tools/`: 工具脚本
- `docs/`: 文档文件

## 许可证

[MIT License](LICENSE)

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目。
