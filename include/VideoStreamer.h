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
    
    // ArUco 标记相关方法
    bool toggleArUcoMode();
    bool isArUcoMode() const;
    bool detectArUcoMarkers(cv::Mat& frame);
    bool calibrateFromArUcoMarkers();
    bool setMarkerGroundCoordinates(int markerId, const cv::Point2f& groundCoord);
    bool saveMarkerCoordinates(const std::string& filename = "");
    bool loadMarkerCoordinates(const std::string& filename = "");

    // 相机标定相关方法
    bool isCameraCalibrationMode() const;
    bool toggleCameraCalibrationMode();
    bool addCalibrationImage();  // 添加当前帧作为标定图像
    bool performCameraCalibration();  // 执行相机标定
    bool saveCameraCalibration(const std::string& filename = "");
    bool loadCameraCalibration(const std::string& filename = "");
    void setChessboardSize(int width, int height);
    void setSquareSize(float size);
    double getCalibrationError() const;
    bool isCameraCalibrated() const;
    size_t getCalibrationImageCount() const; // 新增方法

private:
    void captureThread(); // 添加线程函数声明
    void sendCameraInfo(Connection conn); // 发送摄像头信息给客户端
    
    cv::VideoCapture cap_;
    std::atomic<bool> running_{false};
    std::thread worker_;
    std::mutex mutex_;
    cv::Mat frame_;
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
};
