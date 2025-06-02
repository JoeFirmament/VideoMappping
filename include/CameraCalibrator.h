#ifndef CAMERA_CALIBRATOR_H
#define CAMERA_CALIBRATOR_H

#include <opencv2/opencv.hpp>
#include <vector>
#include <string>

class CameraCalibrator {
public:
    CameraCalibrator();
    
    // 设置棋盘格参数
    void setChessboardSize(int width, int height);
    void setSquareSize(float size); // 实际方格大小（单位：米）
    
    // 添加标定图像
    bool addCalibrationImage(const cv::Mat& image);
    
    // 执行标定
    bool calibrate();
    
    // 保存/加载标定参数
    bool saveCalibrationData(const std::string& filename);
    bool loadCalibrationData(const std::string& filename);
    
    // 图像去畸变
    cv::Mat undistortImage(const cv::Mat& image);
    
    // 获取标定结果
    cv::Mat getCameraMatrix() const { return cameraMatrix; }
    cv::Mat getDistCoeffs() const { return distCoeffs; }
    double getCalibrationError() const { return totalError; }
    bool isCalibrated() const { return calibrated; }
    size_t getImageCount() const { return imagePoints.size(); }

private:
    // 棋盘格参数
    cv::Size boardSize;      // 棋盘格内角点数
    float squareSize;        // 棋盘格方格实际大小
    
    // 标定数据
    std::vector<std::vector<cv::Point3f>> objectPoints;  // 世界坐标系中的点
    std::vector<std::vector<cv::Point2f>> imagePoints;   // 图像坐标系中的点
    
    // 标定结果
    cv::Mat cameraMatrix;    // 相机内参矩阵
    cv::Mat distCoeffs;      // 畸变系数
    double totalError;       // 重投影误差
    bool calibrated;         // 是否已完成标定

    // 图像尺寸
    cv::Size imageSize;      // 图像尺寸
    
    // 辅助函数
    void calculateObjectPoints();
};

#endif // CAMERA_CALIBRATOR_H
