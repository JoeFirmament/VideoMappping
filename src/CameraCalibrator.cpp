#include "CameraCalibrator.h"
#include <opencv2/calib3d.hpp>
#include <iostream>

CameraCalibrator::CameraCalibrator() 
    : boardSize(9, 6)  // 默认9x6的棋盘格
    , squareSize(0.025f)  // 默认25mm
    , calibrated(false)
    , totalError(0.0)
    , imageSize(0, 0)  // 初始化为空尺寸
{
    cameraMatrix = cv::Mat::eye(3, 3, CV_64F);
    distCoeffs = cv::Mat::zeros(8, 1, CV_64F);
}

void CameraCalibrator::setChessboardSize(int width, int height) {
    boardSize.width = width;
    boardSize.height = height;
}

void CameraCalibrator::setSquareSize(float size) {
    squareSize = size;
}

bool CameraCalibrator::addCalibrationImage(const cv::Mat& image) {
    // 设置或验证图像尺寸
    if (imageSize.empty()) {
        imageSize = image.size();
    } else if (imageSize != image.size()) {
        std::cerr << "Image size does not match previous images!" << std::endl;
        return false;
    }
    
    std::vector<cv::Point2f> corners;
    bool found = cv::findChessboardCorners(image, boardSize, corners,
        cv::CALIB_CB_ADAPTIVE_THRESH | cv::CALIB_CB_NORMALIZE_IMAGE);
    
    if (found) {
        cv::Mat grayImage;
        if (image.channels() == 3) {
            cv::cvtColor(image, grayImage, cv::COLOR_BGR2GRAY);
        } else {
            grayImage = image.clone();
        }
        
        // 亚像素级角点检测
        cv::cornerSubPix(grayImage, corners, cv::Size(11, 11), cv::Size(-1, -1),
            cv::TermCriteria(cv::TermCriteria::EPS + cv::TermCriteria::COUNT, 30, 0.1));
            
        imagePoints.push_back(corners);
        
        // 如果这是第一张图片，计算物体点
        if (imagePoints.size() == 1) {
            calculateObjectPoints();
        } else if (objectPoints.size() == 1) {
            // 复制物体点与图像数量相同
            objectPoints.resize(imagePoints.size(), objectPoints[0]);
        }
        
        return true;
    }
    return false;
}

void CameraCalibrator::calculateObjectPoints() {
    std::vector<cv::Point3f> corners;
    for (int i = 0; i < boardSize.height; ++i) {
        for (int j = 0; j < boardSize.width; ++j) {
            corners.push_back(cv::Point3f(j * squareSize, i * squareSize, 0));
        }
    }
    objectPoints.push_back(corners);
}

bool CameraCalibrator::calibrate() {
    if (imagePoints.empty()) {
        std::cerr << "No images have been added for calibration!" << std::endl;
        return false;
    }
    
    std::vector<cv::Mat> rvecs, tvecs;
    int flags = cv::CALIB_RATIONAL_MODEL | cv::CALIB_THIN_PRISM_MODEL;
    
    // 我们需要使用图像尺寸而不是点的尺寸
    if (imageSize.empty()) {
        std::cerr << "Image size is not set!" << std::endl;
        return false;
    }
    
    totalError = cv::calibrateCamera(objectPoints, imagePoints, 
                                   imageSize, 
                                   cameraMatrix, distCoeffs, 
                                   rvecs, tvecs, flags);
                                   
    calibrated = true;
    
    // 计算重投影误差
    double error = 0.0;
    int total_points = 0;
    std::vector<cv::Point2f> projected_points;
    
    for (size_t i = 0; i < objectPoints.size(); ++i) {
        cv::projectPoints(objectPoints[i], rvecs[i], tvecs[i], 
                         cameraMatrix, distCoeffs, projected_points);
                         
        error += cv::norm(cv::Mat(imagePoints[i]), cv::Mat(projected_points), 
                         cv::NORM_L2);
        total_points += objectPoints[i].size();
    }
    
    totalError = std::sqrt(error / total_points);
    std::cout << "Calibration completed with average re-projection error: " 
              << totalError << " pixels" << std::endl;
              
    return true;
}

bool CameraCalibrator::saveCalibrationData(const std::string& filename) {
    if (!calibrated) {
        std::cerr << "Camera is not calibrated yet!" << std::endl;
        return false;
    }
    
    cv::FileStorage fs(filename, cv::FileStorage::WRITE);
    if (!fs.isOpened()) {
        std::cerr << "Failed to open file: " << filename << std::endl;
        return false;
    }
    
    fs << "camera_matrix" << cameraMatrix;
    fs << "dist_coeffs" << distCoeffs;
    fs << "board_width" << boardSize.width;
    fs << "board_height" << boardSize.height;
    fs << "square_size" << squareSize;
    fs << "avg_reprojection_error" << totalError;
    
    fs.release();
    return true;
}

bool CameraCalibrator::loadCalibrationData(const std::string& filename) {
    cv::FileStorage fs(filename, cv::FileStorage::READ);
    if (!fs.isOpened()) {
        std::cerr << "Failed to open file: " << filename << std::endl;
        return false;
    }
    
    fs["camera_matrix"] >> cameraMatrix;
    fs["dist_coeffs"] >> distCoeffs;
    fs["board_width"] >> boardSize.width;
    fs["board_height"] >> boardSize.height;
    fs["square_size"] >> squareSize;
    fs["avg_reprojection_error"] >> totalError;
    
    calibrated = true;
    fs.release();
    return true;
}

cv::Mat CameraCalibrator::undistortImage(const cv::Mat& image) {
    if (!calibrated) {
        std::cerr << "Camera is not calibrated yet!" << std::endl;
        return image;
    }
    
    cv::Mat undistorted;
    cv::undistort(image, undistorted, cameraMatrix, distCoeffs);
    return undistorted;
}
