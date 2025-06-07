#include "VideoStreamer.h"
#include <iostream>
#include <vector>
#include <chrono>
#include <opencv2/imgcodecs.hpp>
#include <sstream>

using namespace std;
using namespace std::chrono_literals;

VideoStreamer::VideoStreamer() : width_(1920), height_(1080), fps_(30) {
    // 初始化
    // 注释掉自动加载标定数据的逻辑，让用户手动选择是否加载
    // std::ifstream file(calibrationFilePath_);
    // if (file.good()) {
    //     file.close();
    //     loadHomography(calibrationFilePath_);
    // }
    
    // 启用保存标定图像功能
    cameraCalibrator_.setSaveCalibrationImages(true);
    std::cout << "Camera calibrator initialized, saveCalibrationImages set to true" << std::endl;
    
    // 初始化双分辨率设置
    displayWidth_ = 960;     // 显示分辨率：16:9比例
    displayHeight_ = 540;
    detectionWidth_ = 1920;  // 检测分辨率：高精度（将根据摄像头实际能力调整）
    detectionHeight_ = 1080;
}

VideoStreamer::~VideoStreamer() {
    stop();
}

bool VideoStreamer::initialize(int camera_id, int width, int height, int fps) {
    // 关闭当前摄像头
    if (cap_.isOpened()) {
        cap_.release();
    }
    
    // 如果指定了摄像头ID，则使用指定的摄像头
    if (camera_id >= 0) {
        if (!cap_.open(camera_id, cv::CAP_V4L2)) {
            cerr << "Error: Could not open camera " << camera_id << " with V4L2 backend" << endl;
            return false;
        }
    } else {
        // 否则尝试自动检测摄像头
        if (!autoDetectCamera()) {
            std::cerr << "Error: Could not auto-detect any camera device" << std::endl;
            std::cout << "Using simulation mode instead" << std::endl;
            
            // 创建一个模拟图像
            frame_ = cv::Mat(height, width, CV_8UC3, cv::Scalar(200, 200, 200));
            
            // 在图像上绘制文字
            cv::putText(frame_, "Simulation Mode - No Camera", cv::Point(50, height/2 - 30), 
                        cv::FONT_HERSHEY_SIMPLEX, 0.8, cv::Scalar(0, 0, 0), 2);
            cv::putText(frame_, "Testing Matrix Display & Export", cv::Point(50, height/2 + 30), 
                        cv::FONT_HERSHEY_SIMPLEX, 0.8, cv::Scalar(0, 0, 0), 2);
            
            // 创建一个模拟的单应性矩阵
            cv::Mat simulatedMatrix = (cv::Mat_<double>(3, 3) << 
                1.2, 0.1, -50.5,
                0.05, 1.3, -30.2,
                0.001, 0.002, 1.0);
            
            // 设置到 HomographyMapper 中
            homographyMapper_.setHomographyMatrix(simulatedMatrix);
            
            // 标记为已标定状态
            homographyMapper_.setCalibrated(true);
            
            // 返回成功
            return true;
        }
    }
    
    // 检查摄像头是否成功打开
    if (!cap_.isOpened()) {
        std::cerr << "Failed to initialize camera" << std::endl;
        return false;
    }
    
    width_ = width;
    height_ = height;
    fps_ = fps;

    // 首先检查摄像头支持的分辨率
    cout << "🔍 [RESOLUTION CHECK] 检查摄像头支持的分辨率..." << endl;
    auto supportedResolutions = getSupportedResolutions();
    
    // 高性能摄像头设置
    cout << "🚀 [HIGH PERFORMANCE SETUP] 配置高性能摄像头参数..." << endl;
    cout << "📐 [RESOLUTION SET] 尝试设置分辨率为 " << width_ << "x" << height_ << endl;
    
    // 基本参数设置
    cap_.set(cv::CAP_PROP_FRAME_WIDTH, width_);
    cap_.set(cv::CAP_PROP_FRAME_HEIGHT, height_);
    cap_.set(cv::CAP_PROP_FPS, fps_);
    cap_.set(cv::CAP_PROP_FOURCC, cv::VideoWriter::fourcc('M', 'J', 'P', 'G'));
    
    // 高性能优化设置
    cap_.set(cv::CAP_PROP_BUFFERSIZE, 1);  // 减少缓冲区大小，降低延迟
    cap_.set(cv::CAP_PROP_AUTO_EXPOSURE, 0.25);  // 禁用自动曝光以提高帧率稳定性
    cap_.set(cv::CAP_PROP_AUTOFOCUS, 0);  // 禁用自动对焦以减少处理时间
    
    cout << "⚡ [PERFORMANCE] 已启用高性能优化设置" << endl;

    // 验证参数
    double actual_width = cap_.get(cv::CAP_PROP_FRAME_WIDTH);
    double actual_height = cap_.get(cv::CAP_PROP_FRAME_HEIGHT);
    double actual_fps = cap_.get(cv::CAP_PROP_FPS);

    cout << "Camera initialized with parameters:" << endl;
    cout << "  Resolution: " << actual_width << "x" << actual_height << endl;
    cout << "  FPS: " << actual_fps << endl;

    // 验证分辨率设置是否成功
    if (abs(actual_width - width) > 50 || abs(actual_height - height) > 50) {
        cout << "⚠️ [RESOLUTION WARNING] 请求分辨率 " << width << "x" << height 
             << " 不被支持，摄像头使用 " << actual_width << "x" << actual_height << endl;
        
        // 动态适配检测分辨率到摄像头实际分辨率
        detectionWidth_ = static_cast<int>(actual_width);
        detectionHeight_ = static_cast<int>(actual_height);
        cout << "🔧 [AUTO ADAPT] 检测分辨率自动调整为: " 
             << detectionWidth_ << "x" << detectionHeight_ << endl;
    } else {
        cout << "✅ [RESOLUTION OK] 分辨率设置成功: " << actual_width << "x" << actual_height << endl;
    }

    // 安全初始化Mat对象 - 防止未初始化的Mat导致异常
    try {
        cv::Mat testFrame;
        if (cap_.read(testFrame) && !testFrame.empty()) {
            std::lock_guard<std::mutex> lock(mutex_);
            frame_ = testFrame.clone();
            detectionFrame_ = testFrame.clone();
            std::cout << "✅ [MAT INIT] Mat objects initialized safely with dimensions: " 
                      << testFrame.cols << "x" << testFrame.rows << std::endl;
        } else {
            std::cerr << "⚠️ [MAT INIT] Unable to read initial frame for Mat initialization" << std::endl;
            // 创建空的Mat对象避免未初始化状态
            std::lock_guard<std::mutex> lock(mutex_);
            frame_ = cv::Mat();
            detectionFrame_ = cv::Mat();
        }
    } catch (const cv::Exception& e) {
        std::cerr << "❌ [MAT INIT] OpenCV error during Mat initialization: " << e.what() << std::endl;
        std::lock_guard<std::mutex> lock(mutex_);
        frame_ = cv::Mat();
        detectionFrame_ = cv::Mat();
    } catch (const std::exception& e) {
        std::cerr << "❌ [MAT INIT] Error during Mat initialization: " << e.what() << std::endl;
        std::lock_guard<std::mutex> lock(mutex_);
        frame_ = cv::Mat();
        detectionFrame_ = cv::Mat();
    }

    return true;
}

bool VideoStreamer::autoDetectCamera() {
    // 尝试直接使用设备路径打开摄像头
    std::vector<std::string> device_paths = {
        "/dev/video0",
        "/dev/video2"
    };
    
    for (const auto& device_path : device_paths) {
        std::cout << "Trying to open camera device: " << device_path << std::endl;
        
        // 直接将摄像头打开到我们的主捕获器中
        // 设置摄像头参数以使用MJPEG格式
        cap_.set(cv::CAP_PROP_FOURCC, cv::VideoWriter::fourcc('M', 'J', 'P', 'G'));
        
        // 直接使用设备路径打开摄像头
        if (cap_.open(device_path, cv::CAP_V4L2)) {
            // 尝试捕获一帧来验证设备
            cv::Mat test_frame;
            cap_ >> test_frame;
            
            if (!test_frame.empty()) {
                std::cout << "Successfully opened camera device: " << device_path << " (MJPEG mode)" << std::endl;
                
                // 打印摄像头默认信息
                double width = cap_.get(cv::CAP_PROP_FRAME_WIDTH);
                double height = cap_.get(cv::CAP_PROP_FRAME_HEIGHT);
                double fps = cap_.get(cv::CAP_PROP_FPS);
                std::cout << "Camera default info - Width: " << width << ", Height: " << height << ", FPS: " << fps << std::endl;
                
                // 摄像头成功打开并捕获了一帧，返回成功
                return true;
            } else {
                std::cerr << "Failed to capture frame from camera device: " << device_path << std::endl;
                // 关闭摄像头并尝试下一个设备
                cap_.release();
            }
        } else {
            std::cerr << "Failed to open camera device: " << device_path << std::endl;
        }
    }
    
    // 如果所有设备路径都失败，尝试使用索引
    std::vector<int> indices = {0, 1, 2, 3, 4};
    for (int idx : indices) {
        std::cout << "Trying to open camera with index: " << idx << std::endl;
        
        // 设置摄像头参数以使用MJPEG格式
        cap_.set(cv::CAP_PROP_FOURCC, cv::VideoWriter::fourcc('M', 'J', 'P', 'G'));
        
        if (cap_.open(idx, cv::CAP_V4L2)) {
            cv::Mat test_frame;
            cap_ >> test_frame;
            
            if (!test_frame.empty()) {
                std::cout << "Successfully opened camera with index: " << idx << std::endl;
                return true;
            } else {
                std::cerr << "Failed to capture frame from camera with index: " << idx << std::endl;
                cap_.release();
            }
        } else {
            std::cerr << "Failed to open camera with index: " << idx << std::endl;
        }
    }
    
    return false; // 没有找到有效的摄像头设备
}

std::vector<std::pair<int, int>> VideoStreamer::getSupportedResolutions() {
    // 高性能分辨率列表 - 优先支持高分辨率以获得更好的图像质量
    std::vector<std::pair<int, int>> resolutions = {
        {1920, 1080},  // Full HD - 优先
        {1280, 720},   // HD
        {1280, 960},   // SXGA-
        {1024, 768},   // XGA
        {800, 600},    // SVGA
        {640, 480}     // VGA - 兼容性保留
    };
    
    // 如果摄像头未打开，返回默认列表
    if (!cap_.isOpened()) {
        return resolutions;
    }
    
    // 验证摄像头支持的分辨率
    std::vector<std::pair<int, int>> supported_resolutions;
    
    // 保存当前分辨率
    double current_width = cap_.get(cv::CAP_PROP_FRAME_WIDTH);
    double current_height = cap_.get(cv::CAP_PROP_FRAME_HEIGHT);
    
    // 检查每个分辨率是否支持
    for (const auto& res : resolutions) {
        // 尝试设置分辨率
        cap_.set(cv::CAP_PROP_FRAME_WIDTH, res.first);
        cap_.set(cv::CAP_PROP_FRAME_HEIGHT, res.second);
        
        // 获取实际设置的分辨率
        double actual_width = cap_.get(cv::CAP_PROP_FRAME_WIDTH);
        double actual_height = cap_.get(cv::CAP_PROP_FRAME_HEIGHT);
        
        // 如果实际分辨率与请求的分辨率接近，则认为支持
        if (std::abs(actual_width - res.first) < 10 && std::abs(actual_height - res.second) < 10) {
            supported_resolutions.push_back({static_cast<int>(actual_width), static_cast<int>(actual_height)});
            cout << "Supported resolution: " << actual_width << "x" << actual_height << endl;
        }
    }
    
    // 恢复原始分辨率
    cap_.set(cv::CAP_PROP_FRAME_WIDTH, current_width);
    cap_.set(cv::CAP_PROP_FRAME_HEIGHT, current_height);
    
    return supported_resolutions.empty() ? resolutions : supported_resolutions;
}

bool VideoStreamer::setResolution(int width, int height) {
    if (!cap_.isOpened()) {
        cerr << "Error: Camera not initialized" << endl;
        return false;
    }
    
    // 设置新分辨率
    cap_.set(cv::CAP_PROP_FRAME_WIDTH, width);
    cap_.set(cv::CAP_PROP_FRAME_HEIGHT, height);
    
    // 验证分辨率是否设置成功
    double actual_width = cap_.get(cv::CAP_PROP_FRAME_WIDTH);
    double actual_height = cap_.get(cv::CAP_PROP_FRAME_HEIGHT);
    
    // 更新内部分辨率变量
    width_ = static_cast<int>(actual_width);
    height_ = static_cast<int>(actual_height);
    
    cout << "Resolution set to: " << width_ << "x" << height_ << endl;
    
    // 如果实际分辨率与请求的分辨率接近，则认为设置成功
    return (std::abs(actual_width - width) < 10 && std::abs(actual_height - height) < 10);
}

std::pair<int, int> VideoStreamer::getCurrentResolution() {
    if (!cap_.isOpened()) {
        return {width_, height_}; // 返回内部存储的分辨率
    }
    
    // 获取当前分辨率
    double width = cap_.get(cv::CAP_PROP_FRAME_WIDTH);
    double height = cap_.get(cv::CAP_PROP_FRAME_HEIGHT);
    
    return {static_cast<int>(width), static_cast<int>(height)};
}

void VideoStreamer::start() {
    if (!cap_.isOpened()) {
        cerr << "Error: Camera not initialized" << endl;
        return;
    }
    
    running_ = true;
    worker_ = thread(&VideoStreamer::captureThread, this);
    
    // 性能优化：启动广播线程时添加帧率控制
    thread broadcast_thread([this]() {
        // 高性能模式 - 使用原始FPS设置，不进行降速
        int targetFPS = fps_;
        
        std::cout << "🚀 [HIGH PERFORMANCE MODE] Target FPS: " << targetFPS << " (High frame rate mode enabled)" << std::endl;
        
        auto lastFrameTime = std::chrono::high_resolution_clock::now();
        auto targetFrameInterval = std::chrono::microseconds(1000000 / targetFPS); // 目标帧间隔
        
        // 性能监控变量
        int broadcastCount = 0;
        auto performanceReportTime = std::chrono::steady_clock::now();
        
        while (running_) {
            auto frameStart = std::chrono::high_resolution_clock::now();
            
            // 执行帧广播
            broadcastFrame();
            broadcastCount++;
            
            auto frameEnd = std::chrono::high_resolution_clock::now();
            
            // 精确的帧率控制 - 只在必要时睡眠
            auto elapsedSinceLastFrame = frameEnd - lastFrameTime;
            auto sleepTime = targetFrameInterval - elapsedSinceLastFrame;
            
            if (sleepTime > std::chrono::microseconds(100)) { // 只有超过100微秒才睡眠
                std::this_thread::sleep_for(sleepTime);
            } else {
                // 使用yield让出CPU时间片，但不强制睡眠
                std::this_thread::yield();
            }
            
            lastFrameTime = std::chrono::high_resolution_clock::now();
            
            // 每10秒输出一次性能报告
            auto broadcastReportTime = std::chrono::steady_clock::now();
            if (std::chrono::duration_cast<std::chrono::seconds>(broadcastReportTime - performanceReportTime).count() >= 10) {
                double actualFPS = broadcastCount / 10.0;
                std::cout << "🎯 [HIGH PERFORMANCE] Actual FPS: " << std::fixed << std::setprecision(2) << actualFPS 
                          << " (Target: " << targetFPS << ")" << std::endl;
                
                // 重置计数器
                broadcastCount = 0;
                performanceReportTime = broadcastReportTime;
            }
        }
    });
    broadcast_thread.detach();
    
    cout << "Video stream started" << endl;
}

void VideoStreamer::stop() {
    if (running_) {
        running_ = false;
        if (worker_.joinable()) {
            worker_.join();
        }
    }
    
    {
        std::lock_guard<std::mutex> lock(conn_mutex_);
        connections_.clear();
    }
    
    if (cap_.isOpened()) {
        cap_.release();
    }
    
    cout << "Video streaming stopped" << endl;
}

void VideoStreamer::handleWebSocket(const crow::request& req, Connection conn) {
    // 添加连接到集合
    {
        std::lock_guard<std::mutex> lock(conn_mutex_);
        connections_.insert(conn);
        std::cout << "WebSocket connection added to VideoStreamer, total connections: " << connections_.size() << std::endl;
    }
    
    // 发送摄像头信息给客户端
    sendCameraInfo(conn);
}

void VideoStreamer::removeWebSocketConnection(Connection conn) {
    std::lock_guard<std::mutex> lock(conn_mutex_);
    auto it = connections_.find(conn);
    if (it != connections_.end()) {
        connections_.erase(it);
        std::cout << "WebSocket connection removed from VideoStreamer, remaining connections: " << connections_.size() << std::endl;
    }
}

void VideoStreamer::sendCameraInfo(Connection conn) {
    if (!conn) return;
    
    try {
        // 获取摄像头支持的分辨率
        auto resolutions = getSupportedResolutions();
        auto current_res = getCurrentResolution();
        
        // 构建分辨率JSON数组
        std::string res_array = "[";
        for (size_t i = 0; i < resolutions.size(); ++i) {
            res_array += "{\"width\":"
                      + std::to_string(resolutions[i].first) + ",\"height\":"
                      + std::to_string(resolutions[i].second) + "}";
            if (i < resolutions.size() - 1) {
                res_array += ",";
            }
        }
        res_array += "]";
        
        // 获取棋盘格参数
        cv::Size boardSize = cameraCalibrator_.getBoardSize();
        float squareSize = cameraCalibrator_.getSquareSize();
        
        // 构建摄像头信息消息
        std::string info_message = std::string("{\"type\":\"camera_info\",")
                              + "\"current_width\":"
                              + std::to_string(current_res.first) + ","
                              + "\"current_height\":"
                              + std::to_string(current_res.second) + ","
                              + "\"fps\":"
                              + std::to_string(fps_) + ","
                              + "\"calibration_mode\":"
                              + (calibrationMode_ ? "true" : "false") + ","
                              + "\"calibrated\":"
                              + (homographyMapper_.isCalibrated() ? "true" : "false") + ","
                              + "\"board_width\":"
                              + std::to_string(boardSize.width) + ","
                              + "\"board_height\":"
                              + std::to_string(boardSize.height) + ","
                              + "\"square_size\":"
                              + std::to_string(int(squareSize * 1000)) + ","
                              + "\"resolutions\":"
                              + res_array + "}";
        
        // 发送消息
        conn->send_text(info_message);
        
    } catch (const std::exception& e) {
        std::cerr << "Error sending camera info: " << e.what() << std::endl;
    }
}

// 单应性矩阵标定相关方法的实现
bool VideoStreamer::addCalibrationPoint(const cv::Point2f& imagePoint, const cv::Point2f& groundPoint) {
    homographyMapper_.addCalibrationPoint(imagePoint, groundPoint);
    return true;
}

bool VideoStreamer::removeLastCalibrationPoint() {
    auto points = homographyMapper_.getCalibrationPoints();
    if (points.empty()) {
        return false;
    }
    
    homographyMapper_.clearCalibrationPoints();
    
    // 重新添加除了最后一个之外的所有点
    for (size_t i = 0; i < points.size() - 1; ++i) {
        homographyMapper_.addCalibrationPoint(points[i].first, points[i].second);
    }
    
    return true;
}

bool VideoStreamer::clearCalibrationPoints() {
    homographyMapper_.clearCalibrationPoints();
    return true;
}

bool VideoStreamer::computeHomography() {
    return homographyMapper_.computeHomography();
}

bool VideoStreamer::saveHomography(const std::string& filename) {
    return homographyMapper_.saveHomography(filename.empty() ? calibrationFilePath_ : filename);
}

bool VideoStreamer::loadHomography(const std::string& filename) {
    return homographyMapper_.loadHomography(filename.empty() ? calibrationFilePath_ : filename);
}

cv::Point2f VideoStreamer::imageToGround(const cv::Point2f& imagePoint) {
    return homographyMapper_.imageToGround(imagePoint);
}

cv::Point2f VideoStreamer::groundToImage(const cv::Point2f& groundPoint) {
    return homographyMapper_.groundToImage(groundPoint);
}

bool VideoStreamer::isCalibrated() const {
    return homographyMapper_.isCalibrated();
}

std::vector<std::pair<cv::Point2f, cv::Point2f>> VideoStreamer::getCalibrationPoints() const {
    return homographyMapper_.getCalibrationPoints();
}

cv::Mat VideoStreamer::getHomographyMatrix() const {
    return homographyMapper_.getHomographyMatrix();
}

// ArUco 标记相关方法实现
bool VideoStreamer::toggleArUcoMode() {
    arucoMode_ = !arucoMode_;
    return arucoMode_;
}

bool VideoStreamer::isArUcoMode() const {
    return arucoMode_;
}

bool VideoStreamer::detectArUcoMarkers(cv::Mat& frame) {
    if (!arucoMode_) return false;
    
    // 检测标记
    std::vector<int> markerIds;
    std::vector<std::vector<cv::Point2f>> markerCorners;
    
    bool detected = homographyMapper_.detectArUcoMarkers(frame, markerIds, markerCorners);
    
    // 发送实时检测结果给前端
    static int lastMarkerCount = -1;
    int currentMarkerCount = markerIds.size();
    
    // 只有当检测到的标记数量发生变化时才发送更新（避免频繁发送）
    if (currentMarkerCount != lastMarkerCount) {
        // 构建检测结果消息，包含详细的标记信息
        bool homographyLoaded = !getHomographyMatrix().empty();
        std::stringstream aruco_message;
        aruco_message << "{\"type\":\"aruco_detection_update\","
                     << "\"detected_markers\":" << currentMarkerCount << ","
                     << "\"homography_loaded\":" << (homographyLoaded ? "true" : "false") << ","
                     << "\"matrix_status\":\"" << (homographyLoaded ? "已标定" : "未标定") << "\"";
        
        // 如果检测到标记，添加详细信息
        if (currentMarkerCount > 0) {
            aruco_message << ",\"markers\":[";
            for (size_t i = 0; i < markerIds.size(); i++) {
                int id = markerIds[i];
                
                // 计算标记中心
                cv::Point2f center(0, 0);
                for (const auto& corner : markerCorners[i]) {
                    center += corner;
                }
                center *= 0.25f;
                
                aruco_message << "{\"id\":" << id 
                             << ",\"center\":{\"x\":" << center.x << ",\"y\":" << center.y << "}";
                
                // 如果已标定，添加地面坐标
                if (homographyLoaded) {
                    cv::Point2f groundPoint = imageToGround(center);
                    aruco_message << ",\"ground_coordinate\":{\"x\":" << groundPoint.x << ",\"y\":" << groundPoint.y << "}";
                }
                
                aruco_message << "}";
                if (i < markerIds.size() - 1) aruco_message << ",";
            }
            aruco_message << "]";
        }
        
        aruco_message << "}";
        
        // 发送消息给所有连接的客户端
        {
            std::lock_guard<std::mutex> lock(conn_mutex_);
            for (auto conn : connections_) {
                if (conn) {
                    try {
                        conn->send_text(aruco_message.str());
                    } catch (const std::exception& e) {
                        std::cerr << "Error sending ArUco detection update: " << e.what() << std::endl;
                    }
                }
            }
        }
        
        lastMarkerCount = currentMarkerCount;
        std::cout << "[ArUco 检测] 更新: 检测到 " << currentMarkerCount << " 个标记，矩阵状态: " 
                  << (homographyLoaded ? "已标定" : "未标定") << std::endl;
    }
    
    if (detected) {
        // 绘制检测到的标记（HomographyMapper会处理所有显示信息）
        homographyMapper_.drawDetectedMarkers(frame, markerIds, markerCorners);
    }
    
    return detected;
}

bool VideoStreamer::calibrateFromArUcoMarkers() {
    if (!arucoMode_) return false;
    
    std::lock_guard<std::mutex> lock(mutex_);
    if (frame_.empty()) return false;
    
    // 使用当前帧和标记地面坐标进行标定
    return homographyMapper_.calibrateFromArUcoMarkers(frame_, homographyMapper_.getMarkerGroundCoordinates());
}

bool VideoStreamer::setMarkerGroundCoordinates(int markerId, const cv::Point2f& groundCoord) {
    homographyMapper_.setMarkerGroundCoordinates(markerId, groundCoord);
    return true;
}

bool VideoStreamer::saveMarkerCoordinates(const std::string& filename) {
    std::string targetFile = filename.empty() ? markerCoordinatesFilePath_ : filename;
    return homographyMapper_.saveMarkerGroundCoordinates(targetFile);
}

bool VideoStreamer::loadMarkerCoordinates(const std::string& filename) {
    std::string targetFile = filename.empty() ? markerCoordinatesFilePath_ : filename;
    return homographyMapper_.loadMarkerGroundCoordinates(targetFile);
}

void VideoStreamer::drawCalibrationPoints(cv::Mat& frame) {
    auto points = homographyMapper_.getCalibrationPoints();
    
    // 绘制标定点
    for (size_t i = 0; i < points.size(); ++i) {
        // 绘制外圈
        cv::circle(frame, points[i].first, 12, cv::Scalar(0, 255, 255), 2);
        // 绘制内圈
        cv::circle(frame, points[i].first, 5, cv::Scalar(0, 0, 255), -1);
        // 绘制十字线 - 使用青色替代绿色
        cv::line(frame, cv::Point(points[i].first.x - 15, points[i].first.y),
                 cv::Point(points[i].first.x + 15, points[i].first.y),
                 cv::Scalar(209, 206, 0), 1); // 青色 (0, 206, 209)
        cv::line(frame, cv::Point(points[i].first.x, points[i].first.y - 15),
                 cv::Point(points[i].first.x, points[i].first.y + 15),
                 cv::Scalar(209, 206, 0), 1); // 青色 (0, 206, 209)
        
        // 绘制点编号
        cv::putText(frame, std::to_string(i + 1), 
                   cv::Point(points[i].first.x + 15, points[i].first.y - 10), 
                   cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 0, 255), 2);
        
        // 绘制地面坐标 - 使用深蓝色替代红色
        std::string coordText = "(" + std::to_string(int(points[i].second.x)) + "," + 
                               std::to_string(int(points[i].second.y)) + ")";
        cv::putText(frame, coordText, 
                   cv::Point(points[i].first.x + 15, points[i].first.y + 15), 
                   cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(112, 25, 25), 2); // 深蓝色 (25, 25, 112)
    }
    
    // 如果已经标定，绘制网格线来显示标定效果
    if (homographyMapper_.isCalibrated() && points.size() >= 4) {
        // 🔧 修复：基于实际标定点范围绘制有意义的网格线
        
        // 找到标定点的边界框
        float minX = std::numeric_limits<float>::max();
        float minY = std::numeric_limits<float>::max();
        float maxX = std::numeric_limits<float>::min();
        float maxY = std::numeric_limits<float>::min();
        
        for (const auto& point : points) {
            minX = std::min(minX, point.second.x);
            minY = std::min(minY, point.second.y);
            maxX = std::max(maxX, point.second.x);
            maxY = std::max(maxY, point.second.y);
        }
        
        // 计算标定区域的实际尺寸
        float rangeX = maxX - minX;
        float rangeY = maxY - minY;
        
        // 🔧 修复：根据实际范围确定合适的网格间距
        float gridSpacing = 50.0f; // 基础网格间距50mm
        
        // 如果标定区域很大，增加网格间距；如果很小，减少网格间距
        if (rangeX > 500 || rangeY > 500) {
            gridSpacing = 100.0f; // 大区域使用100mm间距
        } else if (rangeX < 200 && rangeY < 200) {
            gridSpacing = 25.0f;  // 小区域使用25mm间距
        }
        
        // 🔧 修复：扩展显示区域，但保持合理的范围
        float expandRatio = 0.3f; // 向外扩展30%
        minX -= rangeX * expandRatio;
        maxX += rangeX * expandRatio;
        minY -= rangeY * expandRatio;
        maxY += rangeY * expandRatio;
        
        // 🔧 修复：对齐网格线到合理的坐标值
        // 将边界对齐到网格间距的倍数
        float alignedMinX = std::floor(minX / gridSpacing) * gridSpacing;
        float alignedMaxX = std::ceil(maxX / gridSpacing) * gridSpacing;
        float alignedMinY = std::floor(minY / gridSpacing) * gridSpacing;
        float alignedMaxY = std::ceil(maxY / gridSpacing) * gridSpacing;
        
        // 🔧 修复：绘制水平网格线（Y坐标固定）
        for (float y = alignedMinY; y <= alignedMaxY; y += gridSpacing) {
            cv::Point2f start = groundToImage(cv::Point2f(alignedMinX, y));
            cv::Point2f end = groundToImage(cv::Point2f(alignedMaxX, y));
            
            // 检查线条是否在图像范围内
            if ((start.x >= -50 && start.x <= frame.cols + 50) || (end.x >= -50 && end.x <= frame.cols + 50)) {
                if ((start.y >= -50 && start.y <= frame.rows + 50) || (end.y >= -50 && end.y <= frame.rows + 50)) {
                    
                    // 绘制网格线 - 使用青色
                    cv::line(frame, start, end, cv::Scalar(209, 206, 0), 2, cv::LINE_AA); // 青色 BGR(209, 206, 0)
                    
                    // 在合适的位置显示Y坐标值
                    if (start.x >= 0 && start.x < frame.cols - 50 && start.y >= 15 && start.y < frame.rows - 5) {
                        cv::putText(frame, std::to_string(int(y)), 
                                   cv::Point(std::max(5.0f, start.x + 5), start.y - 5), 
                                   cv::FONT_HERSHEY_SIMPLEX, 0.4, cv::Scalar(209, 206, 0), 1, cv::LINE_AA);
                    }
                }
            }
        }
        
        // 🔧 修复：绘制垂直网格线（X坐标固定）
        for (float x = alignedMinX; x <= alignedMaxX; x += gridSpacing) {
            cv::Point2f start = groundToImage(cv::Point2f(x, alignedMinY));
            cv::Point2f end = groundToImage(cv::Point2f(x, alignedMaxY));
            
            // 检查线条是否在图像范围内
            if ((start.x >= -50 && start.x <= frame.cols + 50) || (end.x >= -50 && end.x <= frame.cols + 50)) {
                if ((start.y >= -50 && start.y <= frame.rows + 50) || (end.y >= -50 && end.y <= frame.rows + 50)) {
                    
                    // 绘制网格线 - 使用青色
                    cv::line(frame, start, end, cv::Scalar(209, 206, 0), 2, cv::LINE_AA); // 青色 BGR(209, 206, 0)
                    
                    // 在合适的位置显示X坐标值
                    if (start.x >= 5 && start.x < frame.cols - 30 && start.y >= 0 && start.y < frame.rows - 20) {
                        cv::putText(frame, std::to_string(int(x)), 
                                   cv::Point(start.x + 5, std::min((float)frame.rows - 5, start.y + 20)), 
                                   cv::FONT_HERSHEY_SIMPLEX, 0.4, cv::Scalar(209, 206, 0), 1, cv::LINE_AA);
                    }
                }
            }
        }
        
        // 🔧 新增：显示网格信息
        std::string gridInfo = "Grid: " + std::to_string(int(gridSpacing)) + "mm, Range: " + 
                              std::to_string(int(rangeX)) + "x" + std::to_string(int(rangeY)) + "mm";
        cv::putText(frame, gridInfo, cv::Point(10, 120), cv::FONT_HERSHEY_SIMPLEX, 0.5, 
                   cv::Scalar(209, 206, 0), 1, cv::LINE_AA);
    }
    
    // 添加标定状态信息
    std::string statusText = "Calibration Mode: " + std::string(calibrationMode_ ? "ON" : "OFF");
    cv::putText(frame, statusText, cv::Point(10, 30), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 0, 255), 2);
    
    if (homographyMapper_.isCalibrated()) {
        cv::putText(frame, "Calibrated: YES", cv::Point(10, 60), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(226, 43, 138), 2); // 紫色 (138, 43, 226) 表示成功
    } else {
        cv::putText(frame, "Calibrated: NO (Need 4+ points)", cv::Point(10, 60), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(112, 25, 25), 2); // 深蓝色 (25, 25, 112) 表示错误
    }
    
    cv::putText(frame, "Points: " + std::to_string(points.size()), cv::Point(10, 90), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(255, 123, 0), 2); // 蓝色 (0, 123, 255) 表示信息
}

void VideoStreamer::broadcastFrame() {
    static int frame_count = 0;  // 静态帧计数器
    static auto lastBroadcastTime = std::chrono::steady_clock::now();
    static int skippedFrames = 0;
    
    // 严格的连接检查 - 在任何Mat操作之前进行
    {
        std::lock_guard<std::mutex> conn_lock(conn_mutex_);
        if (connections_.empty()) {
            return; // 没有连接时直接返回，避免不必要的处理
        }
    }
    
    // 检查运行状态
    if (!running_) {
        return;
    }
    
    // 帧率控制逻辑
    auto currentTime = std::chrono::steady_clock::now();
    auto timeSinceLastBroadcast = std::chrono::duration_cast<std::chrono::milliseconds>(currentTime - lastBroadcastTime);
    
    // 动态帧率控制：根据连接数调整
    int targetInterval;
    {
        std::lock_guard<std::mutex> conn_lock(conn_mutex_);
        if (connections_.size() <= 1) {
            targetInterval = 33; // ~30 FPS for single connection
        } else if (connections_.size() <= 2) {
            targetInterval = 40; // ~25 FPS for 2 connections
        } else {
            targetInterval = 50; // ~20 FPS for 3+ connections
        }
    }
    
    if (timeSinceLastBroadcast.count() < targetInterval) {
        skippedFrames++;
        return;
    }
    
    skippedFrames = 0;
    lastBroadcastTime = currentTime;
    
    // 性能监控：广播开始时间
    auto broadcastStart = std::chrono::high_resolution_clock::now();
    
    // 再次检查连接状态（双重检查）
    {
        std::lock_guard<std::mutex> conn_lock(conn_mutex_);
        if (connections_.empty()) {
            return;
        }
    }

    cv::Mat processedFrame;
    
    // 性能监控：帧获取时间
    auto frameGetStart = std::chrono::high_resolution_clock::now();
    
    // 根据模式选择合适的帧分辨率 - 添加异常处理
    try {
        if (cameraCalibrationMode_) {
            // 相机标定模式：使用优化的显示帧（已包含角点绘制）
            processedFrame = getDisplayFrame();
            if (processedFrame.empty()) {
                std::cerr << "Warning: getDisplayFrame() returned empty frame in calibration mode" << std::endl;
                return;
            }
        } else {
            // 普通模式：使用原始帧 - 添加更严格的检查
            std::lock_guard<std::mutex> lock(mutex_);
            if (frame_.empty() || frame_.cols <= 0 || frame_.rows <= 0) {
                std::cerr << "Warning: frame_ is empty or invalid in normal mode" << std::endl;
                return;
            }
            
            // 验证Mat对象的有效性
            if (frame_.type() != CV_8UC3 && frame_.type() != CV_8UC1) {
                std::cerr << "Warning: frame_ has invalid type: " << frame_.type() << std::endl;
                return;
            }
            
            processedFrame = frame_.clone();
            if (processedFrame.empty()) {
                std::cerr << "Warning: frame_.clone() failed" << std::endl;
                return;
            }
        }
    } catch (const cv::Exception& e) {
        std::cerr << "OpenCV error in frame acquisition: " << e.what() << std::endl;
        return;
    } catch (const std::exception& e) {
        std::cerr << "Error in frame acquisition: " << e.what() << std::endl;
        return;
    }
    
    auto frameGetEnd = std::chrono::high_resolution_clock::now();
    double frameGetTime = std::chrono::duration<double, std::milli>(frameGetEnd - frameGetStart).count();
    
    // 验证帧数据完整性 - 更严格的检查
    if (processedFrame.empty() || processedFrame.cols <= 0 || processedFrame.rows <= 0) {
        std::cerr << "Warning: Invalid frame data after acquisition, skipping broadcast" << std::endl;
        return;
    }
    
    // 验证Mat对象的连续性和类型
    if (!processedFrame.isContinuous()) {
        try {
            processedFrame = processedFrame.clone();
        } catch (const cv::Exception& e) {
            std::cerr << "OpenCV error making frame continuous: " << e.what() << std::endl;
            return;
        }
    }
    
    // 性能监控：处理时间
    auto processingStart = std::chrono::high_resolution_clock::now();
    
    // 如果在标定模式下，绘制标定点 - 添加异常处理
    try {
        if (calibrationMode_) {
            drawCalibrationPoints(processedFrame);
        }
        
        // 如果在ArUco模式下，检测并绘制ArUco标记
        if (arucoMode_) {
            detectArUcoMarkers(processedFrame);
        }
    } catch (const cv::Exception& e) {
        std::cerr << "OpenCV error in frame processing: " << e.what() << std::endl;
        return;
    } catch (const std::exception& e) {
        std::cerr << "Error in frame processing: " << e.what() << std::endl;
        return;
    }
    
    auto processingEnd = std::chrono::high_resolution_clock::now();
    double processingTime = std::chrono::duration<double, std::milli>(processingEnd - processingStart).count();
    
    // 在编码前进一步验证帧的有效性
    if (processedFrame.type() != CV_8UC3 && processedFrame.type() != CV_8UC1) {
        std::cerr << "Warning: Invalid frame type for JPEG encoding: " << processedFrame.type() << std::endl;
        return;
    }
    
    // 验证帧是否连续
    if (!processedFrame.isContinuous()) {
        // 如果不连续，创建一个连续的副本
        try {
            processedFrame = processedFrame.clone();
        } catch (const cv::Exception& e) {
            std::cerr << "OpenCV error making frame continuous for encoding: " << e.what() << std::endl;
            return;
        }
    }
    
    // 性能监控：JPEG编码时间
    auto encodeStart = std::chrono::high_resolution_clock::now();
    
    // 将帧编码为JPEG，使用优化的参数减少编码时间
    std::vector<uchar> buf;
    
    // 局域网环境优化：使用更高的JPEG质量，确保图像清晰度
    int jpegQuality = 92;  // 局域网环境使用高质量
    bool fastMode = false;
    
    // 检查是否需要启用快速模式（仅在极端情况下）
    static auto lastOverrunTime = std::chrono::steady_clock::now();
    static int overrunCount = 0;
    
    auto now = std::chrono::steady_clock::now();
    if (std::chrono::duration_cast<std::chrono::seconds>(now - lastOverrunTime).count() < 5) {
        overrunCount++;
        if (overrunCount > 5) { // 提高阈值：5秒内超过5次超时才启用快速模式
            fastMode = true;
            jpegQuality = 75;  // 即使在快速模式下也保持较高质量
        }
    } else {
        overrunCount = 0;
        lastOverrunTime = now;
    }
    
    // 根据连接数轻微调整质量（局域网环境下影响较小）
    if (connections_.size() > 2) {
        jpegQuality = std::max(80, jpegQuality - 5 * (int)(connections_.size() - 2));
    }
    
    std::vector<int> encode_params = {
        cv::IMWRITE_JPEG_QUALITY, jpegQuality,
        cv::IMWRITE_JPEG_OPTIMIZE, fastMode ? 0 : 1,  // 快速模式禁用优化
        cv::IMWRITE_JPEG_PROGRESSIVE, 0  // 禁用渐进式JPEG以加快编码
    };
    
    // 保持双分辨率设计：直接使用处理后的帧进行编码
    // 局域网环境下不需要额外降采样
    cv::Mat encodeFrame = processedFrame;
    
    bool encode_success = false;
    try {
        encode_success = cv::imencode(".jpg", encodeFrame, buf, encode_params);
    } catch (const cv::Exception& e) {
        std::cerr << "OpenCV error in JPEG encoding: " << e.what() << std::endl;
        return;
    } catch (const std::exception& e) {
        std::cerr << "Error in JPEG encoding: " << e.what() << std::endl;
        return;
    }
    
    auto encodeEnd = std::chrono::high_resolution_clock::now();
    double encodeTime = std::chrono::duration<double, std::milli>(encodeEnd - encodeStart).count();
    
    // 检查编码是否成功
    if (!encode_success || buf.empty()) {
        std::cerr << "Warning: JPEG encoding failed, skipping frame transmission" << std::endl;
        return;
    }
    
    // 验证编码结果的大小合理性
    if (buf.size() < 100 || buf.size() > 1024 * 1024) {  // 100字节到1MB之间
        std::cerr << "Warning: JPEG encoded size abnormal (" << buf.size() 
                  << " bytes), skipping frame transmission" << std::endl;
        return;
    }
    
    // 性能监控：网络传输时间
    auto networkStart = std::chrono::high_resolution_clock::now();
    
    // 每100帧发送一次分辨率信息
    if (frame_count % 100 == 0) {
        // 构建帧信息消息
        std::string info_message = std::string("{\"type\":\"frame_info\",\"width\":")
                              + std::to_string(processedFrame.cols) + ",\"height\":"
                              + std::to_string(processedFrame.rows) + "}";
        
        // 广播帧信息
        std::lock_guard<std::mutex> conn_lock(conn_mutex_);
        for (auto conn : connections_) {
            if (conn) {
                try {
                    conn->send_text(info_message);
                } catch (const std::exception& e) {
                    std::cerr << "Error sending frame info: " << e.what() << std::endl;
                }
            }
        }
    }
    
    // 广播帧数据 - 添加异常处理
    {
        std::lock_guard<std::mutex> lock(conn_mutex_);
        for (auto conn : connections_) {
            if (conn) {
                try {
                    conn->send_binary(std::string(buf.begin(), buf.end()));
                } catch (const std::exception& e) {
                    std::cerr << "Error sending frame data: " << e.what() << std::endl;
                }
            }
        }
    }
    
    auto networkEnd = std::chrono::high_resolution_clock::now();
    double networkTime = std::chrono::duration<double, std::milli>(networkEnd - networkStart).count();
    
    // 总体广播时间
    auto broadcastEnd = std::chrono::high_resolution_clock::now();
    double totalBroadcastTime = std::chrono::duration<double, std::milli>(broadcastEnd - broadcastStart).count();
    
    frame_count++;
    
    // 性能报告（每5秒输出一次详细分析）
    static auto lastDetailedReport = std::chrono::steady_clock::now();
    static double totalFrameGetTime = 0, totalProcessingTime = 0, totalEncodeTime = 0, totalNetworkTime = 0, cumulativeBroadcastTime = 0;
    static int reportFrameCount = 0;
    
    totalFrameGetTime += frameGetTime;
    totalProcessingTime += processingTime;
    totalEncodeTime += encodeTime;
    totalNetworkTime += networkTime;
    cumulativeBroadcastTime += totalBroadcastTime;
    reportFrameCount++;
    
    auto reportNow = std::chrono::steady_clock::now();
    if (std::chrono::duration_cast<std::chrono::seconds>(reportNow - lastDetailedReport).count() >= 5) {
        double avgFrameGet = totalFrameGetTime / reportFrameCount;
        double avgProcessing = totalProcessingTime / reportFrameCount;
        double avgEncode = totalEncodeTime / reportFrameCount;
        double avgNetwork = totalNetworkTime / reportFrameCount;
        double avgTotal = cumulativeBroadcastTime / reportFrameCount;
        
        std::cout << "📊 [BROADCAST PERFORMANCE] Average times (ms):" << std::endl;
        std::cout << "  📥 Frame Get: " << std::fixed << std::setprecision(2) << avgFrameGet << "ms" << std::endl;
        std::cout << "  🔧 Processing: " << avgProcessing << "ms" << std::endl;
        std::cout << "  📷 JPEG Encode: " << avgEncode << "ms" << std::endl;
        std::cout << "  🌐 Network Send: " << avgNetwork << "ms" << std::endl;
        std::cout << "  📡 Total Broadcast: " << avgTotal << "ms" << std::endl;
        std::cout << "  🔄 Theoretical FPS: " << (1000.0 / avgTotal) << std::endl;
        std::cout << "  📦 Avg JPEG Size: " << (buf.size() / 1024) << "KB" << std::endl;
        std::cout << "  🔗 Connections: " << connections_.size() << std::endl;
        
        // 重置计数器
        totalFrameGetTime = totalProcessingTime = totalEncodeTime = totalNetworkTime = cumulativeBroadcastTime = 0;
        reportFrameCount = 0;
        lastDetailedReport = reportNow;
    }
}

bool VideoStreamer::getFrame(cv::Mat& frame) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (frame_.empty()) {
        return false;
    }
    
    frame = frame_.clone();
    return true;
}

void VideoStreamer::captureThread() {
    cv::Mat frame;
    
    // 性能监控变量
    auto lastPerformanceReport = std::chrono::steady_clock::now();
    int frameProcessedCount = 0;
    double totalProcessingTime = 0.0;
    
    while (running_) {
        auto frameStart = std::chrono::high_resolution_clock::now();
        
        if (cap_.read(frame)) {
            // 成功读取帧，重置失败计数器
            if (frameReadFailureCount_ > 0) {
                std::cout << "📹 [CAMERA RECOVERY] 摄像头恢复正常，重置失败计数器" << std::endl;
                frameReadFailureCount_ = 0;
                sendErrorNotification("camera_recovery", "camera_recovered", "device_working_normally");
            }
            
            if (frame.empty()) {
                cerr << "Error: Empty frame received" << endl;
                continue;
            }
            
            // 验证帧数据完整性
            if (frame.cols <= 0 || frame.rows <= 0) {
                cerr << "Error: Invalid frame dimensions" << endl;
                continue;
            }
            
            // 创建处理帧的副本，避免修改原始帧
            cv::Mat processedFrame = frame.clone();
            
            // 性能优化：只在相机校正启用且已标定时才进行畸变校正
            // 并且不在标定模式下进行校正（标定需要原始畸变图像）
            if (isCameraCalibrated() && cameraCorrectionEnabled_ && !cameraCalibrationMode_) {
                try {
                    auto undistortStart = std::chrono::high_resolution_clock::now();
                    
                    cv::Mat undistortedFrame = cameraCalibrator_.undistortImage(processedFrame);
                    
                    auto undistortEnd = std::chrono::high_resolution_clock::now();
                    double undistortTime = std::chrono::duration<double, std::milli>(undistortEnd - undistortStart).count();
                    
                    // 验证去畸变结果是否有效
                    if (!undistortedFrame.empty() && 
                        undistortedFrame.cols == processedFrame.cols && 
                        undistortedFrame.rows == processedFrame.rows) {
                        processedFrame = undistortedFrame;
                        
                        // 性能日志（每10秒输出一次）
                        static auto lastUndistortLog = std::chrono::steady_clock::now();
                        auto undistortLogTime = std::chrono::steady_clock::now();
                        if (std::chrono::duration_cast<std::chrono::seconds>(undistortLogTime - lastUndistortLog).count() >= 10) {
                            std::cout << "📊 [PERFORMANCE] Undistortion time: " << undistortTime << "ms" << std::endl;
                            lastUndistortLog = undistortLogTime;
                        }
                    } else {
                        cerr << "Warning: Undistortion returned invalid result, using original frame" << endl;
                    }
                } catch (const cv::Exception& e) {
                    cerr << "OpenCV error in undistortion: " << e.what() << endl;
                    // 继续使用原始帧，不进行去畸变
                } catch (const std::exception& e) {
                    cerr << "Error in undistortion: " << e.what() << endl;
                    // 继续使用原始帧，不进行去畸变
                }
            }
            
            // 如果处于相机标定模式，使用轻量级显示处理
            if (cameraCalibrationMode_) {
                try {
                    // 性能优化：降低标定模式下的检测频率
                    static int detectionCounter = 0;
                    detectionCounter++;
                    
                    // 每3帧才进行一次角点检测，减少CPU负载
                    if (detectionCounter % 3 == 0) {
                        // 对显示分辨率的帧进行轻量级处理
                        cv::Mat displayFrame;
                        if (processedFrame.cols != displayWidth_ || processedFrame.rows != displayHeight_) {
                            cv::resize(processedFrame, displayFrame, cv::Size(displayWidth_, displayHeight_));
                        } else {
                            displayFrame = processedFrame.clone();
                        }
                        
                        // 只在显示帧上做简单的棋盘格检测和绘制（低精度，快速）
                        std::vector<cv::Point2f> corners;
                        bool found = false;
                        
                        // 使用更宽松的检测条件进行快速检测
                        int quickFlags = cv::CALIB_CB_ADAPTIVE_THRESH;
                        found = cv::findChessboardCorners(displayFrame, cameraCalibrator_.getBoardSize(), corners, quickFlags);
                        
                        if (found) {
                            // 缩放角点坐标回原始帧比例（用于精确显示）
                            float scaleX = (float)processedFrame.cols / displayWidth_;
                            float scaleY = (float)processedFrame.rows / displayHeight_;
                            for (auto& corner : corners) {
                                corner.x *= scaleX;
                                corner.y *= scaleY;
                            }
                            
                            cv::drawChessboardCorners(processedFrame, cameraCalibrator_.getBoardSize(), corners, found);
                            cv::putText(processedFrame, "Chessboard OK", cv::Point(processedFrame.cols - 160, 30),
                                      cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(226, 43, 138), 2, cv::LINE_AA); // 紫色 (138, 43, 226) 表示成功
                        } else {
                            cv::putText(processedFrame, "Searching...", cv::Point(processedFrame.cols - 150, 30),
                                      cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(0, 100, 255), 2, cv::LINE_AA);
                        }
                    }
                    
                    // 显示当前校正状态
                    if (cameraCorrectionEnabled_ && isCameraCalibrated()) {
                        cv::putText(processedFrame, "Correction: OFF (Calibration Mode)", cv::Point(10, processedFrame.rows - 20),
                                  cv::FONT_HERSHEY_SIMPLEX, 0.5, cv::Scalar(255, 165, 0), 1, cv::LINE_AA);
                    }
                    
                } catch (const std::exception& e) {
                    cerr << "Error in chessboard visualization: " << e.what() << endl;
                }
            } else if (calibrationMode_) {
                // 坐标变换标定模式的简洁提示
                                    cv::putText(processedFrame, "Click to add point", cv::Point(processedFrame.cols - 180, 30),
                          cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(0, 149, 255), 2, cv::LINE_AA); // 橙色 (255, 149, 0) 表示提示
            } else {
                // 正常模式：显示校正状态
                if (isCameraCalibrated() && cameraCorrectionEnabled_) {
                    cv::putText(processedFrame, "Correction: ON", cv::Point(10, processedFrame.rows - 20),
                              cv::FONT_HERSHEY_SIMPLEX, 0.5, cv::Scalar(226, 43, 138), 1, cv::LINE_AA); // 紫色 (138, 43, 226) 表示成功
                } else if (isCameraCalibrated()) {
                    cv::putText(processedFrame, "Correction: OFF", cv::Point(10, processedFrame.rows - 20),
                              cv::FONT_HERSHEY_SIMPLEX, 0.5, cv::Scalar(112, 25, 25), 1, cv::LINE_AA); // 深蓝色 (25, 25, 112) 表示错误
                }
            }
            
            // 双流策略：强化安全的Mat操作
            {
                std::lock_guard<std::mutex> lock(mutex_);
                
                // 验证processedFrame的有效性
                if (processedFrame.empty() || processedFrame.cols <= 0 || processedFrame.rows <= 0) {
                    std::cerr << "Warning: Invalid processedFrame, skipping frame update" << std::endl;
                    continue;
                }
                
                try {
                    // 安全的复制策略：确保Mat对象完整性
                    frame_ = processedFrame.clone();           // 深度复制，避免move后的空对象
                    detectionFrame_ = processedFrame.clone();  // 独立复制，确保两个对象都有效
                    
                    // 验证复制结果
                    if (frame_.empty() || detectionFrame_.empty()) {
                        std::cerr << "Error: Frame copy operation failed" << std::endl;
                        continue;
                    }
                    
                } catch (const cv::Exception& e) {
                    std::cerr << "OpenCV error in frame copying: " << e.what() << std::endl;
                    continue;
                } catch (const std::exception& e) {
                    std::cerr << "Error in frame copying: " << e.what() << std::endl;
                    continue;
                }
            }
            
            // 性能监控
            auto frameEnd = std::chrono::high_resolution_clock::now();
            double frameTime = std::chrono::duration<double, std::milli>(frameEnd - frameStart).count();
            totalProcessingTime += frameTime;
            frameProcessedCount++;
            
            // 每10秒输出一次性能报告
            auto frameReportTime = std::chrono::steady_clock::now();
            if (std::chrono::duration_cast<std::chrono::seconds>(frameReportTime - lastPerformanceReport).count() >= 10) {
                double avgProcessingTime = totalProcessingTime / frameProcessedCount;
                double theoreticalFPS = 1000.0 / avgProcessingTime;
                
                std::cout << "📊 [PERFORMANCE] Avg frame processing: " << avgProcessingTime << "ms, "
                          << "Theoretical FPS: " << theoreticalFPS << ", "
                          << "Correction: " << (cameraCorrectionEnabled_ ? "ON" : "OFF") << ", "
                          << "Calibration mode: " << (cameraCalibrationMode_ ? "ON" : "OFF") << std::endl;
                
                // 添加系统资源信息
                std::cout << "🖥️ [SYSTEM RESOURCES]\n" << getSystemResourceInfo() << std::endl;
                
                // 重置计数器
                totalProcessingTime = 0.0;
                frameProcessedCount = 0;
                lastPerformanceReport = frameReportTime;
            }
            
        } else {
            // 帧读取失败处理
            frameReadFailureCount_++;
            cerr << "Error: Failed to read frame (count: " << frameReadFailureCount_ << ")" << endl;
            
            // 检测连续失败情况并通知前端
            if (frameReadFailureCount_ >= 5) {
                // 连续5次失败，发送警告
                sendErrorNotification("camera_warning", "摄像头读取不稳定", 
                                    "连续" + std::to_string(frameReadFailureCount_) + "次帧读取失败");
            }
            
            if (frameReadFailureCount_ >= 20) {
                // 连续20次失败，发送严重错误
                sendErrorNotification("camera_critical", "摄像头设备异常", 
                                    "设备可能被占用或断开连接，请检查摄像头状态");
                
                // 尝试重新初始化摄像头
                attemptCameraRecovery();
            }
            
            this_thread::sleep_for(chrono::milliseconds(100));
        }
    }
}

// 相机标定相关方法实现
bool VideoStreamer::isCameraCalibrationMode() const {
    return cameraCalibrationMode_;
}

void VideoStreamer::setCameraCalibrationMode(bool mode) {
    cameraCalibrationMode_ = mode;
}

bool VideoStreamer::addCameraCalibrationImage() {
    // 使用高分辨率检测帧进行标定
    cv::Mat detectionFrame;
    
    try {
        detectionFrame = getDetectionFrame();
        
        if (detectionFrame.empty()) {
            std::cerr << "No detection frame available for calibration" << std::endl;
            return false;
        }
        
        // 额外的有效性检查
        if (detectionFrame.cols <= 0 || detectionFrame.rows <= 0) {
            std::cerr << "Invalid detection frame dimensions for calibration" << std::endl;
            return false;
        }
        
        // 检查数据完整性
        if (detectionFrame.type() != CV_8UC3 && detectionFrame.type() != CV_8UC1) {
            std::cerr << "Invalid detection frame type for calibration: " << detectionFrame.type() << std::endl;
            return false;
        }
        
        return cameraCalibrator_.addCalibrationImage(detectionFrame);
        
    } catch (const cv::Exception& e) {
        std::cerr << "OpenCV error in addCameraCalibrationImage: " << e.what() << std::endl;
        return false;
    } catch (const std::exception& e) {
        std::cerr << "Error in addCameraCalibrationImage: " << e.what() << std::endl;
        return false;
    }
}

bool VideoStreamer::calibrateCamera() {
    return cameraCalibrator_.calibrate();
}

bool VideoStreamer::saveCameraCalibrationData(const std::string& filename) {
    std::string filepath = filename.empty() ? cameraCalibrationFilePath_ : filename;
    return cameraCalibrator_.saveCalibrationData(filepath);
}

bool VideoStreamer::loadCameraCalibrationData(const std::string& filename) {
    std::string filepath = filename.empty() ? cameraCalibrationFilePath_ : filename;
    return cameraCalibrator_.loadCalibrationData(filepath);
}

cv::Mat VideoStreamer::getCameraMatrix() const {
    return cameraCalibrator_.getCameraMatrix();
}

cv::Mat VideoStreamer::getDistCoeffs() const {
    return cameraCalibrator_.getDistCoeffs();
}

bool VideoStreamer::getCameraCalibrationMatrices(cv::Mat& cameraMatrix, cv::Mat& distCoeffs) const {
    if (!isCameraCalibrated()) {
        return false;
    }
    
    cameraMatrix = getCameraMatrix();
    distCoeffs = getDistCoeffs();
    
    return !cameraMatrix.empty() && !distCoeffs.empty();
}

double VideoStreamer::getCalibrationError() const {
    return cameraCalibrator_.getCalibrationError();
}

size_t VideoStreamer::getCalibrationImageCount() const {
    return cameraCalibrator_.getImageCount();
}

void VideoStreamer::setChessboardSize(int width, int height) {
    cameraCalibrator_.setChessboardSize(width, height);
}

void VideoStreamer::setSquareSize(float size) {
    cameraCalibrator_.setSquareSize(size);
}

void VideoStreamer::setBlurKernelSize(int size) {
    cameraCalibrator_.setBlurKernelSize(size);
}

void VideoStreamer::setQualityCheckLevel(int level) {
    CameraCalibrator::QualityCheckLevel qualityLevel;
    switch (level) {
        case 0: qualityLevel = CameraCalibrator::STRICT; break;
        case 1: qualityLevel = CameraCalibrator::BALANCED; break;
        case 2: qualityLevel = CameraCalibrator::PERMISSIVE; break;
        default: qualityLevel = CameraCalibrator::BALANCED; break;
    }
    cameraCalibrator_.setQualityCheckLevel(qualityLevel);
}

int VideoStreamer::getBlurKernelSize() const {
    return cameraCalibrator_.getBlurKernelSize();
}

bool VideoStreamer::isCameraCalibrated() const {
    return cameraCalibrator_.isCalibrated();
}

// 新增：相机标定会话管理方法实现
void VideoStreamer::startNewCameraCalibrationSession() {
    std::cout << "VideoStreamer: Starting new camera calibration session" << std::endl;
    cameraCalibrator_.startNewCalibrationSession();
    
    // 发送会话状态更新到客户端
    std::string response = "{\"type\":\"camera_calibration_session_started\","
                          "\"message\":\"New calibration session started\","
                          "\"image_count\":0}";
    
    // 广播到所有连接的客户端
    std::lock_guard<std::mutex> lock(conn_mutex_);
    for (auto& conn : connections_) {
        try {
            conn->send_text(response);
        } catch (const std::exception& e) {
            std::cerr << "Error sending session start notification: " << e.what() << std::endl;
        }
    }
}

void VideoStreamer::clearCurrentCameraCalibrationSession() {
    std::cout << "VideoStreamer: Clearing current camera calibration session" << std::endl;
    cameraCalibrator_.clearCurrentSession();
    
    // 发送会话清除通知到客户端
    std::string response = "{\"type\":\"camera_calibration_session_cleared\","
                          "\"message\":\"Current session cleared\","
                          "\"image_count\":0}";
    
    // 广播到所有连接的客户端
    std::lock_guard<std::mutex> lock(conn_mutex_);
    for (auto& conn : connections_) {
        try {
            conn->send_text(response);
        } catch (const std::exception& e) {
            std::cerr << "Error sending session clear notification: " << e.what() << std::endl;
        }
    }
}

size_t VideoStreamer::getCurrentSessionImageCount() const {
    return cameraCalibrator_.getCurrentSessionImageCount();
}

bool VideoStreamer::startAutoCalibrationCapture(int durationSeconds, int intervalMs) {
    // 如果已经在自动采集中，返回false
    if (autoCapturing_) {
        std::cerr << "Auto calibration capture already running" << std::endl;
        return false;
    }
    
    // 如果不在相机标定模式，返回false
    if (!cameraCalibrationMode_) {
        std::cerr << "Must be in camera calibration mode to start auto capture" << std::endl;
        return false;
    }
    
    // 设置自动采集标志
    autoCapturing_ = true;
    
    // 启动自动采集线程
    autoCapturingThread_ = std::thread(&VideoStreamer::autoCalibrationCaptureThread, this, durationSeconds, intervalMs);
    autoCapturingThread_.detach();
    
    std::cout << "Started auto calibration capture for " << durationSeconds << " seconds with " 
              << intervalMs << "ms interval" << std::endl;
    
    return true;
}

bool VideoStreamer::stopAutoCalibrationCapture() {
    // 如果没有在自动采集中，返回false
    if (!autoCapturing_) {
        std::cerr << "Auto calibration capture not running" << std::endl;
        return false;
    }
    
    // 设置自动采集标志为false
    autoCapturing_ = false;
    
    std::cout << "Stopped auto calibration capture" << std::endl;
    
    return true;
}

void VideoStreamer::autoCalibrationCaptureThread(int durationSeconds, int intervalMs) {
    // 计算结束时间
    auto endTime = std::chrono::steady_clock::now() + std::chrono::seconds(durationSeconds);
    int successCount = 0;
    int attemptCount = 0;
    
    std::cout << "=== AUTO CALIBRATION CAPTURE THREAD STARTED ===" << std::endl;
    std::cout << "Duration: " << durationSeconds << " seconds, Interval: " << intervalMs << " ms" << std::endl;
    std::cout << "Initial image count: " << cameraCalibrator_.getCurrentSessionImageCount() << std::endl;
    
    // 循环直到达到结束时间或停止标志被设置
    while (autoCapturing_ && std::chrono::steady_clock::now() < endTime) {
        // 获取用于检测的高分辨率帧
        cv::Mat detectionFrame = getDetectionFrame();
        
        if (!detectionFrame.empty()) {
            attemptCount++;
            std::cout << "\n--- Attempt " << attemptCount << " ---" << std::endl;
            std::cout << "Frame size: " << detectionFrame.cols << "x" << detectionFrame.rows << std::endl;
            
            // 尝试检测棋盘格并添加标定图像
            std::vector<cv::Point2f> corners;
            bool found = cameraCalibrator_.detectChessboard(detectionFrame, corners, true);  // 使用完整的调试检测
            
            std::cout << "Chessboard detection result: " << (found ? "SUCCESS" : "FAILED") << std::endl;
            if (found) {
                std::cout << "Detected " << corners.size() << " corners" << std::endl;
                
                // 记录添加前的图片数量
                size_t beforeCount = cameraCalibrator_.getCurrentSessionImageCount();
                std::cout << "Image count before adding: " << beforeCount << std::endl;
                
                // 如果检测成功，添加标定图像
                bool addSuccess = cameraCalibrator_.addCalibrationImage(detectionFrame);
                
                // 记录添加后的图片数量
                size_t afterCount = cameraCalibrator_.getCurrentSessionImageCount();
                std::cout << "Add calibration image result: " << (addSuccess ? "SUCCESS" : "FAILED") << std::endl;
                std::cout << "Image count after adding: " << afterCount << std::endl;
                
                if (addSuccess) {
                    successCount++;
                    std::cout << "✅ Successfully added calibration image " << successCount 
                              << " (attempt " << attemptCount << ")" << std::endl;
                    std::cout << "Total images in session: " << afterCount << std::endl;
                    
                    // 立即向所有WebSocket客户端发送更新的标定状态
                    std::string status_message = std::string("{\"type\":\"camera_calibration_status\",")
                                          + "\"calibration_mode\":"
                                          + (cameraCalibrationMode_ ? "true" : "false") + ","
                                          + "\"calibrated\":"
                                          + (cameraCalibrator_.isCalibrated() ? "true" : "false") + ","
                                          + "\"image_count\":"
                                          + std::to_string(cameraCalibrator_.getImageCount()) + ","
                                          + "\"current_session_count\":"
                                          + std::to_string(cameraCalibrator_.getCurrentSessionImageCount()) + ","
                                          + "\"saved_count\":"
                                          + std::to_string(cameraCalibrator_.getImageCount()) + ","
                                          + "\"auto_capture_progress\": true}";
                    
                    std::cout << "Sending WebSocket message: " << status_message << std::endl;
                    
                    std::lock_guard<std::mutex> lock(conn_mutex_);
                    std::cout << "Number of WebSocket connections: " << connections_.size() << std::endl;
                    for (auto conn : connections_) {
                        if (conn) {
                            try {
                                conn->send_text(status_message);
                                std::cout << "Message sent to WebSocket client successfully" << std::endl;
                            } catch (const std::exception& e) {
                                std::cout << "Error sending WebSocket message: " << e.what() << std::endl;
                            }
                        }
                    }
                } else {
                    std::cout << "❌ Failed to add calibration image (quality check failed)" << std::endl;
                }
            } else {
                std::cout << "❌ No chessboard detected in this frame" << std::endl;
            }
        } else {
            std::cout << "❌ Empty detection frame" << std::endl;
        }
        
        // 等待指定的间隔时间
        std::this_thread::sleep_for(std::chrono::milliseconds(intervalMs));
    }
    
    // 设置自动采集标志为false
    autoCapturing_ = false;
    
    std::cout << "\n=== AUTO CALIBRATION CAPTURE COMPLETED ===" << std::endl;
    std::cout << "Final results:" << std::endl;
    std::cout << "- Attempts: " << attemptCount << std::endl;
    std::cout << "- Successful captures: " << successCount << std::endl;
    std::cout << "- Final image count in session: " << cameraCalibrator_.getCurrentSessionImageCount() << std::endl;
    
    // 向所有WebSocket客户端发送自动采集完成的消息
    std::string completion_message = std::string("{\"type\":\"auto_capture_completed\",")
                              + "\"success_count\":"
                              + std::to_string(successCount) + ","
                              + "\"attempt_count\":"
                              + std::to_string(attemptCount) + ","
                              + "\"image_count\":"
                              + std::to_string(cameraCalibrator_.getImageCount()) + "}";
    
    std::cout << "Sending completion message: " << completion_message << std::endl;
    
    std::lock_guard<std::mutex> lock(conn_mutex_);
    for (auto conn : connections_) {
        if (conn) {
            try {
                conn->send_text(completion_message);
                std::cout << "Completion message sent to WebSocket client" << std::endl;
            } catch (const std::exception& e) {
                std::cout << "Error sending completion message: " << e.what() << std::endl;
            }
        }
    }
}

// 双分辨率支持方法
void VideoStreamer::setDisplayResolution(int width, int height) {
    displayWidth_ = width;
    displayHeight_ = height;
}

void VideoStreamer::setDetectionResolution(int width, int height) {
    detectionWidth_ = width;
    detectionHeight_ = height;
}

cv::Mat VideoStreamer::getDisplayFrame() {
    std::lock_guard<std::mutex> lock(mutex_);
    
    // 多重安全检查
    if (frame_.empty()) {
        return cv::Mat();
    }
    
    if (frame_.cols <= 0 || frame_.rows <= 0) {
        std::cerr << "Warning: frame_ has invalid dimensions: " 
                  << frame_.cols << "x" << frame_.rows << std::endl;
        return cv::Mat();
    }
    
    try {
        // 如果当前帧分辨率与显示分辨率不同，进行缩放
        if (frame_.cols != displayWidth_ || frame_.rows != displayHeight_) {
            cv::Mat displayFrame;
            cv::resize(frame_, displayFrame, cv::Size(displayWidth_, displayHeight_));
            
            // 验证缩放结果
            if (displayFrame.empty()) {
                std::cerr << "Error: Frame resize operation failed" << std::endl;
                return cv::Mat();
            }
            
            return displayFrame;
        }
        
        // 安全的深度复制
        cv::Mat result = frame_.clone();
        
        // 验证克隆结果
        if (result.empty()) {
            std::cerr << "Error: Frame clone operation failed" << std::endl;
            return cv::Mat();
        }
        
        return result;
        
    } catch (const cv::Exception& e) {
        std::cerr << "OpenCV error in getDisplayFrame: " << e.what() << std::endl;
        return cv::Mat();
    } catch (const std::exception& e) {
        std::cerr << "Error in getDisplayFrame: " << e.what() << std::endl;
        return cv::Mat();
    }
}

cv::Mat VideoStreamer::getDetectionFrame() {
    std::lock_guard<std::mutex> lock(mutex_);
    
    // 多重安全检查
    if (detectionFrame_.empty()) {
        std::cerr << "Warning: detectionFrame_ is empty" << std::endl;
        return cv::Mat();
    }
    
    if (detectionFrame_.cols <= 0 || detectionFrame_.rows <= 0) {
        std::cerr << "Warning: detectionFrame_ has invalid dimensions: " 
                  << detectionFrame_.cols << "x" << detectionFrame_.rows << std::endl;
        return cv::Mat();
    }
    
    try {
        // 安全的深度复制
        cv::Mat result = detectionFrame_.clone();
        
        // 验证克隆结果
        if (result.empty() || result.cols <= 0 || result.rows <= 0) {
            std::cerr << "Error: Frame clone operation failed" << std::endl;
            return cv::Mat();
        }
        
        return result;
        
    } catch (const cv::Exception& e) {
        std::cerr << "OpenCV error in getDetectionFrame: " << e.what() << std::endl;
        return cv::Mat();
    } catch (const std::exception& e) {
        std::cerr << "Error in getDetectionFrame: " << e.what() << std::endl;
        return cv::Mat();
    }
}

// 相机校正控制方法
void VideoStreamer::setCameraCorrectionEnabled(bool enabled) {
    cameraCorrectionEnabled_ = enabled;
    std::cout << "📸 [CAMERA CORRECTION] Set to: " << (enabled ? "enabled" : "disabled") << std::endl;
}

bool VideoStreamer::isCameraCorrectionEnabled() const {
    return cameraCorrectionEnabled_;
}

// 添加系统资源监控函数
std::string VideoStreamer::getSystemResourceInfo() {
    std::ostringstream info;
    
    try {
        // CPU使用率（通过读取/proc/stat）
        std::ifstream cpuFile("/proc/stat");
        if (cpuFile.is_open()) {
            std::string line;
            std::getline(cpuFile, line);
            // 简化版本，只获取第一行CPU总体信息
            info << "💻 CPU: " << line.substr(0, 50) << "...\n";
            cpuFile.close();
        }
        
        // 内存使用率（通过读取/proc/meminfo）
        std::ifstream memFile("/proc/meminfo");
        if (memFile.is_open()) {
            std::string line;
            long totalMem = 0, availMem = 0;
            while (std::getline(memFile, line)) {
                if (line.find("MemTotal:") == 0) {
                    sscanf(line.c_str(), "MemTotal: %ld kB", &totalMem);
                } else if (line.find("MemAvailable:") == 0) {
                    sscanf(line.c_str(), "MemAvailable: %ld kB", &availMem);
                }
                if (totalMem > 0 && availMem > 0) break;
            }
            memFile.close();
            
            if (totalMem > 0 && availMem > 0) {
                long usedMem = totalMem - availMem;
                double usagePercent = (double)usedMem / totalMem * 100;
                info << "🧠 Memory: " << (usedMem/1024) << "MB/" << (totalMem/1024) 
                     << "MB (" << std::fixed << std::setprecision(1) << usagePercent << "%)\n";
            }
        }
        
        // GPU信息（如果可用）
        std::ifstream gpuFile("/sys/class/drm/card0/device/gpu_busy_percent");
        if (gpuFile.is_open()) {
            int gpuUsage;
            gpuFile >> gpuUsage;
            info << "🎮 GPU: " << gpuUsage << "%\n";
            gpuFile.close();
        }
        
        // 网络统计（通过读取/proc/net/dev）
        std::ifstream netFile("/proc/net/dev");
        if (netFile.is_open()) {
            std::string line;
            // 跳过前两行标题
            std::getline(netFile, line);
            std::getline(netFile, line);
            
            while (std::getline(netFile, line)) {
                if (line.find("wlan0:") != std::string::npos || 
                    line.find("eth0:") != std::string::npos ||
                    line.find("enp") != std::string::npos) {
                    // 提取网络接口统计信息
                    info << "🌐 Network: " << line.substr(0, 60) << "...\n";
                    break;
                }
            }
            netFile.close();
        }
        
    } catch (const std::exception& e) {
        info << "❌ Error getting system info: " << e.what() << "\n";
    }
    
    return info.str();
}

// ArUco 检测参数设置方法实现
void VideoStreamer::setArUcoDetectionParameters(int adaptiveThreshWinSizeMin, int adaptiveThreshWinSizeMax, 
                                               int adaptiveThreshWinSizeStep, double adaptiveThreshConstant) {
    homographyMapper_.setDetectionParameters(adaptiveThreshWinSizeMin, adaptiveThreshWinSizeMax, 
                                           adaptiveThreshWinSizeStep, adaptiveThreshConstant);
}

void VideoStreamer::setArUcoCornerRefinementMethod(int method) {
    homographyMapper_.setCornerRefinementMethod(method);
}

void VideoStreamer::getArUcoDetectionParameters(int& adaptiveThreshWinSizeMin, int& adaptiveThreshWinSizeMax, 
                                               int& adaptiveThreshWinSizeStep, double& adaptiveThreshConstant) const {
    homographyMapper_.getDetectionParameters(adaptiveThreshWinSizeMin, adaptiveThreshWinSizeMax, 
                                           adaptiveThreshWinSizeStep, adaptiveThreshConstant);
}

int VideoStreamer::getArUcoCornerRefinementMethod() const {
    return homographyMapper_.getCornerRefinementMethod();
}

// 坐标变换标定模式控制方法实现
bool VideoStreamer::toggleCalibrationMode() {
    calibrationMode_ = !calibrationMode_;
    
    std::cout << "📐 [COORDINATE CALIBRATION] 标定模式切换: " << (calibrationMode_ ? "启用" : "禁用") << std::endl;
    
    return calibrationMode_;
}

bool VideoStreamer::isCalibrationMode() const {
    return calibrationMode_;
}

// 错误通知方法实现
void VideoStreamer::sendErrorNotification(const std::string& errorType, const std::string& title, const std::string& message) {
    // 构建错误通知JSON
    std::string errorNotification = "{"
        "\"type\":\"error_notification\","
        "\"error_type\":\"" + errorType + "\","
        "\"title\":\"" + title + "\","
        "\"message\":\"" + message + "\","
        "\"timestamp\":\"" + std::to_string(std::time(nullptr)) + "\""
    "}";
    
    std::cout << "🚨 [ERROR NOTIFICATION] " << errorType << ": " << title << " - " << message << std::endl;
    
    // 广播错误通知到所有WebSocket连接
    std::lock_guard<std::mutex> lock(conn_mutex_);
    for (auto& conn : connections_) {
        try {
            conn->send_text(errorNotification);
        } catch (const std::exception& e) {
            std::cerr << "Error sending error notification: " << e.what() << std::endl;
        }
    }
}

// 摄像头恢复尝试方法实现
void VideoStreamer::attemptCameraRecovery() {
    std::cout << "🔧 [CAMERA RECOVERY] 尝试恢复摄像头设备..." << std::endl;
    
    // 释放当前摄像头资源
    if (cap_.isOpened()) {
        cap_.release();
        std::this_thread::sleep_for(std::chrono::milliseconds(500)); // 等待资源释放
    }
    
    // 尝试重新初始化摄像头
    bool recoverySuccess = false;
    
    // 尝试重新打开设备
    if (autoDetectCamera()) {
        // 尝试设置之前的分辨率
        cap_.set(cv::CAP_PROP_FRAME_WIDTH, width_);
        cap_.set(cv::CAP_PROP_FRAME_HEIGHT, height_);
        cap_.set(cv::CAP_PROP_FPS, fps_);
        
        // 验证设备是否正常工作
        cv::Mat testFrame;
        if (cap_.read(testFrame) && !testFrame.empty()) {
            recoverySuccess = true;
            frameReadFailureCount_ = 0;  // 重置失败计数器
            std::cout << "✅ [CAMERA RECOVERY] 摄像头恢复成功" << std::endl;
            sendErrorNotification("camera_recovery_success", "摄像头恢复成功", "设备重新初始化完成");
        }
    }
    
    if (!recoverySuccess) {
        std::cout << "❌ [CAMERA RECOVERY] 摄像头恢复失败" << std::endl;
        sendErrorNotification("camera_recovery_failed", "摄像头恢复失败", 
                            "无法重新初始化摄像头，请检查设备连接或重启程序");
    }
}
