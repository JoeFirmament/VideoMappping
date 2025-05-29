#include "VideoStreamer.h"
#include <iostream>
#include <vector>
#include <chrono>
#include <opencv2/imgcodecs.hpp>

using namespace std;
using namespace std::chrono_literals;

VideoStreamer::VideoStreamer() : width_(1280), height_(720), fps_(30) {
    // 初始化
    // 尝试加载已有的标定数据
    std::ifstream file(calibrationFilePath_);
    if (file.good()) {
        file.close();
        loadHomography(calibrationFilePath_);
    }
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
        cap_.open(camera_id);
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

    // 尝试自动检测和选择摄像头设备
    if (camera_id < 0) {
        if (!autoDetectCamera()) {
            cerr << "Error: Could not auto-detect any camera device" << endl;
            return false;
        }
    } else {
        // 尝试打开指定的摄像头
        if (!cap_.open(camera_id, cv::CAP_V4L2)) {
            cerr << "Error: Could not open camera " << camera_id << " with V4L2 backend" << endl;
            return false;
        }
    }

    // 设置摄像头参数
    cap_.set(cv::CAP_PROP_FRAME_WIDTH, width_);
    cap_.set(cv::CAP_PROP_FRAME_HEIGHT, height_);
    cap_.set(cv::CAP_PROP_FPS, fps_);
    cap_.set(cv::CAP_PROP_FOURCC, cv::VideoWriter::fourcc('M', 'J', 'P', 'G'));

    // 验证参数
    double actual_width = cap_.get(cv::CAP_PROP_FRAME_WIDTH);
    double actual_height = cap_.get(cv::CAP_PROP_FRAME_HEIGHT);
    double actual_fps = cap_.get(cv::CAP_PROP_FPS);

    cout << "Camera initialized with parameters:" << endl;
    cout << "  Resolution: " << actual_width << "x" << actual_height << endl;
    cout << "  FPS: " << actual_fps << endl;

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
                
                // 打印摄像头信息
                double width = cap_.get(cv::CAP_PROP_FRAME_WIDTH);
                double height = cap_.get(cv::CAP_PROP_FRAME_HEIGHT);
                double fps = cap_.get(cv::CAP_PROP_FPS);
                std::cout << "Camera info - Width: " << width << ", Height: " << height << ", FPS: " << fps << std::endl;
                
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
    // 常见的摄像头支持的分辨率
    std::vector<std::pair<int, int>> resolutions = {
        {640, 480},    // VGA
        {800, 600},    // SVGA
        {1024, 768},   // XGA
        {1280, 720},   // HD
        {1280, 960},   // SXGA-
        {1920, 1080}   // Full HD
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
    
    // 启动广播线程
    thread broadcast_thread([this]() {
        while (running_) {
            this_thread::sleep_for(chrono::milliseconds(1000 / fps_));
            broadcastFrame();
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
    }
    
    // 发送摄像头信息给客户端
    sendCameraInfo(conn);
    
    // 注意：在实际应用中，我们需要在WebSocket连接关闭时从集合中移除连接
    // 但由于Crow的API限制，我们需要在main.cpp中处理这个逻辑
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
    
    if (detected) {
        // 绘制检测到的标记
        homographyMapper_.drawDetectedMarkers(frame, markerIds, markerCorners);
        
        // 在画面上显示检测到的标记数量
        cv::putText(frame, "检测到 " + std::to_string(markerIds.size()) + " 个ArUco标记", 
                   cv::Point(10, 30), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 255, 0), 2);
    } else {
        // 显示未检测到标记的信息
        cv::putText(frame, "未检测到ArUco标记", 
                   cv::Point(10, 30), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 0, 255), 2);
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
        // 绘制十字线
        cv::line(frame, cv::Point(points[i].first.x - 15, points[i].first.y),
                 cv::Point(points[i].first.x + 15, points[i].first.y),
                 cv::Scalar(0, 255, 0), 1);
        cv::line(frame, cv::Point(points[i].first.x, points[i].first.y - 15),
                 cv::Point(points[i].first.x, points[i].first.y + 15),
                 cv::Scalar(0, 255, 0), 1);
        
        // 绘制点编号
        cv::putText(frame, std::to_string(i + 1), 
                   cv::Point(points[i].first.x + 15, points[i].first.y - 10), 
                   cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 0, 255), 2);
        
        // 绘制地面坐标
        std::string coordText = "(" + std::to_string(int(points[i].second.x)) + "," + 
                               std::to_string(int(points[i].second.y)) + ")";
        cv::putText(frame, coordText, 
                   cv::Point(points[i].first.x + 15, points[i].first.y + 15), 
                   cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(255, 0, 0), 2);
    }
    
    // 如果已经标定，绘制网格线来显示标定效果
    if (homographyMapper_.isCalibrated() && points.size() >= 4) {
        // 绘制网格线来显示标定效果
        int gridSize = 50; // 网格大小（地面坐标系中）
        int gridCount = 10; // 网格数量
        
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
        
        // 绘制水平线
        for (int i = 0; i <= gridCount; ++i) {
            float y = minY + i * gridSize;
            if (y > maxY) break;
            
            cv::Point2f start = groundToImage(cv::Point2f(minX, y));
            cv::Point2f end = groundToImage(cv::Point2f(maxX, y));
            
            cv::line(frame, start, end, cv::Scalar(0, 255, 0), 1);
            
            // 标记坐标
            cv::putText(frame, std::to_string(int(y)), 
                       cv::Point(start.x + 5, start.y), 
                       cv::FONT_HERSHEY_SIMPLEX, 0.3, cv::Scalar(0, 255, 0), 1);
        }
        
        // 绘制垂直线
        for (int i = 0; i <= gridCount; ++i) {
            float x = minX + i * gridSize;
            if (x > maxX) break;
            
            cv::Point2f start = groundToImage(cv::Point2f(x, minY));
            cv::Point2f end = groundToImage(cv::Point2f(x, maxY));
            
            cv::line(frame, start, end, cv::Scalar(0, 255, 0), 1);
            
            // 标记坐标
            cv::putText(frame, std::to_string(int(x)), 
                       cv::Point(start.x, start.y + 15), 
                       cv::FONT_HERSHEY_SIMPLEX, 0.3, cv::Scalar(0, 255, 0), 1);
        }
    }
    
    // 添加标定状态信息
    std::string statusText = "Calibration Mode: " + std::string(calibrationMode_ ? "ON" : "OFF");
    cv::putText(frame, statusText, cv::Point(10, 30), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 0, 255), 2);
    
    if (homographyMapper_.isCalibrated()) {
        cv::putText(frame, "Calibrated: YES", cv::Point(10, 60), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 255, 0), 2);
    } else {
        cv::putText(frame, "Calibrated: NO (Need 4+ points)", cv::Point(10, 60), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 0, 255), 2);
    }
    
    cv::putText(frame, "Points: " + std::to_string(points.size()), cv::Point(10, 90), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(255, 0, 0), 2);
}

void VideoStreamer::broadcastFrame() {
    static int frame_count = 0;
    
    // 检查是否有连接
    if (connections_.empty()) {
        return;
    }
    
    // 获取当前帧
    cv::Mat processedFrame;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (frame_.empty()) {
            return;
        }
        processedFrame = frame_.clone();
    }
    
    // 如果在标定模式下，绘制标定点
    if (calibrationMode_) {
        drawCalibrationPoints(processedFrame);
    }
    
    // 如果在ArUco模式下，检测并绘制ArUco标记
    if (arucoMode_) {
        detectArUcoMarkers(processedFrame);
    }
    
    // 将帧编码为JPEG
    std::vector<uchar> buf;
    cv::imencode(".jpg", processedFrame, buf);
    
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
                conn->send_text(info_message);
            }
        }
    }
    
    // 广播帧数据
    std::lock_guard<std::mutex> lock(conn_mutex_);
    for (auto conn : connections_) {
        if (conn) {
            conn->send_binary(std::string(buf.begin(), buf.end()));
        }
    }
    
    frame_count++;
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
    
    while (running_) {
        if (cap_.read(frame)) {
            if (frame.empty()) {
                cerr << "Error: Empty frame received" << endl;
                continue;
            }
            
            // 更新当前帧
            {
                std::lock_guard<std::mutex> lock(mutex_);
                frame_ = frame.clone();
            }
        } else {
            cerr << "Error: Failed to read frame" << endl;
            this_thread::sleep_for(chrono::milliseconds(100));
        }
    }
}
