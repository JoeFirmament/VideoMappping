#pragma once

#include <opencv2/opencv.hpp>
#include <thread>
#include <mutex>
#include <atomic>
#include <unordered_set>
#include <crow.h>
#include "HomographyMapper.h"
#include "CameraCalibrator.h"

using namespace std;
using Connection = crow::websocket::connection*;

class VideoStreamer {
public:
    VideoStreamer();
    ~VideoStreamer();

    bool initialize(int camera_id = -1, int width = 1280, int height = 720, int fps = 30);
    void start();
    void stop();
    void broadcastFrame();
    bool getFrame(cv::Mat& frame);
    bool autoDetectCamera();
    std::vector<std::pair<int, int>> getSupportedResolutions();
    bool setResolution(int width, int height);
    std::pair<int, int> getCurrentResolution();
    void handleWebSocket(const crow::request& req, Connection conn);
    void removeWebSocketConnection(Connection conn);
    
    // 单应性矩阵标定相关方法
    bool addCalibrationPoint(const cv::Point2f& imagePoint, const cv::Point2f& groundPoint);
    bool removeLastCalibrationPoint();
    bool clearCalibrationPoints();
    bool computeHomography();
    bool saveHomography(const std::string& filename);
    bool loadHomography(const std::string& filename);
    cv::Point2f imageToGround(const cv::Point2f& imagePoint);
    cv::Point2f groundToImage(const cv::Point2f& groundPoint);
    bool isCalibrated() const;
    std::vector<std::pair<cv::Point2f, cv::Point2f>> getCalibrationPoints() const;
    void drawCalibrationPoints(cv::Mat& frame);
    cv::Mat getHomographyMatrix() const; // 获取单应性矩阵数据
    
    // 坐标变换标定模式控制
    bool toggleCalibrationMode(); // 切换标定模式
    bool isCalibrationMode() const; // 获取当前标定模式状态
    
    // ArUco 标记相关方法
    bool toggleArUcoMode();
    bool isArUcoMode() const;
    bool detectArUcoMarkers(cv::Mat& frame);
    bool calibrateFromArUcoMarkers();
    bool setMarkerGroundCoordinates(int markerId, const cv::Point2f& groundCoord);
    bool saveMarkerCoordinates(const std::string& filename = "");
    bool loadMarkerCoordinates(const std::string& filename = "");
    
    // ArUco 检测参数设置方法
    void setArUcoDetectionParameters(int adaptiveThreshWinSizeMin, int adaptiveThreshWinSizeMax, 
                                    int adaptiveThreshWinSizeStep, double adaptiveThreshConstant);
    void setArUcoCornerRefinementMethod(int method);
    void getArUcoDetectionParameters(int& adaptiveThreshWinSizeMin, int& adaptiveThreshWinSizeMax, 
                                    int& adaptiveThreshWinSizeStep, double& adaptiveThreshConstant) const;
    int getArUcoCornerRefinementMethod() const;

    // 相机标定相关方法
    void setCameraCalibrationMode(bool mode);
    bool isCameraCalibrationMode() const;
    bool addCameraCalibrationImage();
    bool calibrateCamera();
    bool saveCameraCalibrationData(const std::string& filename);
    bool loadCameraCalibrationData(const std::string& filename);
    cv::Mat undistortImage(const cv::Mat& image);
    
    // 获取标定结果
    cv::Mat getCameraMatrix() const;
    cv::Mat getDistCoeffs() const;
    bool getCameraCalibrationMatrices(cv::Mat& cameraMatrix, cv::Mat& distCoeffs) const;
    
    // 新增：相机标定会话管理
    void startNewCameraCalibrationSession();  // 开始新的标定会话
    void clearCurrentCameraCalibrationSession(); // 清除当前会话
    size_t getCurrentSessionImageCount() const;   // 获取当前会话图像数

    // 自动采集标定图像
    bool startAutoCalibrationCapture(int durationSeconds = 10, int intervalMs = 500);
    bool stopAutoCalibrationCapture();
    bool isAutoCapturing() const { return autoCapturing_; }

    // 双分辨率支持
    void setDisplayResolution(int width, int height);
    void setDetectionResolution(int width, int height);
    cv::Mat getDisplayFrame();
    cv::Mat getDetectionFrame();

    // 棋盘格和质量设置
    void setChessboardSize(int width, int height);
    void setSquareSize(float size);
    void setBlurKernelSize(int size);
    int getBlurKernelSize() const;
    void setQualityCheckLevel(int level);
    double getCalibrationError() const;
    bool isCameraCalibrated() const;
    size_t getCalibrationImageCount() const;
    
    // 相机校正控制
    void setCameraCorrectionEnabled(bool enabled);
    bool isCameraCorrectionEnabled() const;
    
    // 系统性能监控
    std::string getSystemResourceInfo();

private:
    void captureThread(); // 添加线程函数声明
    void sendCameraInfo(Connection conn); // 发送摄像头信息给客户端
    void autoCalibrationCaptureThread(int durationSeconds, int intervalMs); // 添加自动采集线程声明
    
    cv::VideoCapture cap_;
    std::atomic<bool> running_{false};
    std::thread worker_;
    std::mutex mutex_;
    cv::Mat frame_;
    cv::Mat detectionFrame_;  // 用于检测的原始高分辨率帧
    int width_;
    int height_;
    int fps_;
    std::unordered_set<Connection> connections_;
    std::mutex conn_mutex_;
    
    // 单应性矩阵相关成员
    HomographyMapper homographyMapper_;
    bool calibrationMode_{false};  // 标定模式标志
    std::string calibrationFilePath_{"/home/radxa/Qworkspace/VideoMapping/data/homography.xml"}; // 默认标定文件路径
    
    // ArUco 标记相关成员
    bool arucoMode_{false};  // ArUco 标记检测模式
    std::string markerCoordinatesFilePath_{"/home/radxa/Qworkspace/VideoMapping/data/markers.xml"}; // 标记地面坐标文件路径

    // 相机标定相关成员
    CameraCalibrator cameraCalibrator_; // 相机标定器
    bool cameraCalibrationMode_{false}; // 相机标定模式标志
    std::string cameraCalibrationFilePath_{"/home/radxa/Qworkspace/VideoMapping/data/camera_calibration.xml"}; // 相机标定文件路径

    // 自动采集标定图像相关
    std::atomic<bool> autoCapturing_{false};
    std::thread autoCapturingThread_;

    // 双分辨率支持
    int displayWidth_, displayHeight_;
    int detectionWidth_, detectionHeight_;
    
    // 相机校正控制
    std::atomic<bool> cameraCorrectionEnabled_{false};
    
    // 错误处理和通知
    std::atomic<int> frameReadFailureCount_{0};  // 帧读取失败计数器
    void sendErrorNotification(const std::string& errorType, const std::string& title, const std::string& message);
    void attemptCameraRecovery();  // 尝试摄像头恢复
};
