#include "CameraCalibrator.h"
#include <opencv2/calib3d.hpp>
#include <iostream>
#include <ctime>  // 添加time.h头文件

CameraCalibrator::CameraCalibrator() 
    : boardSize(8, 5)  // 默认9x6的棋盘格，角点数是8x5
    , squareSize(0.030f)  // 默认30mm
    , calibrated(false)
    , totalError(0.0)
    , imageSize(0, 0)  // 初始化为空尺寸
    , saveCalibrationImages(false)  // 默认不保存图像
    , blurKernelSize(5)  // 默认5x5高斯模糊核
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

// 公共棋盘格检测方法，供前端和后端共用
bool CameraCalibrator::detectChessboard(const cv::Mat& image, std::vector<cv::Point2f>& corners, bool isForCalibration) {
    // 准备灰度图像
    cv::Mat grayImage;
    if (image.channels() == 3) {
        cv::cvtColor(image, grayImage, cv::COLOR_BGR2GRAY);
    } else {
        grayImage = image.clone();
    }
    
    // 保存调试图像（仅在标定模式下）
    if (isForCalibration) {
        std::string debugDir = "calibration_images/debug";
        system("mkdir -p calibration_images/debug");
        cv::imwrite(debugDir + "/gray_" + std::to_string(time(nullptr)) + ".jpg", grayImage);
        
        // 添加更详细的调试信息
        std::cout << "=== CHESSBOARD DETECTION DEBUG ===" << std::endl;
        std::cout << "Image size: " << image.cols << "x" << image.rows << std::endl;
        std::cout << "Image channels: " << image.channels() << std::endl;
        std::cout << "Target board size: " << boardSize.width << "x" << boardSize.height << " corners" << std::endl;
        std::cout << "Expected corner count: " << (boardSize.width * boardSize.height) << std::endl;
    }
    
    bool found = false;
    
    // 方法1: 使用宽松的检测参数 - 移除严格的FILTER_QUADS和FAST_CHECK
    int relaxed_flags = cv::CALIB_CB_ADAPTIVE_THRESH | 
                       cv::CALIB_CB_NORMALIZE_IMAGE;
    
    found = cv::findChessboardCorners(grayImage, boardSize, corners, relaxed_flags);
    
    if (isForCalibration) {
        std::cout << "Method 1 - Relaxed detection (" << boardSize.width << "x" << boardSize.height << "): " 
                  << (found ? "SUCCESS" : "FAILED") << std::endl;
        if (found) {
            std::cout << "Found " << corners.size() << " corners with relaxed flags" << std::endl;
        }
    }
    
    // 方法2: 高斯模糊预处理（优先尝试，适合低光照环境）
    if (!found && blurKernelSize > 0) {
        cv::Mat blurredImage;
        cv::GaussianBlur(grayImage, blurredImage, cv::Size(blurKernelSize, blurKernelSize), 0);
        
        found = cv::findChessboardCorners(blurredImage, boardSize, corners, relaxed_flags);
        
        if (isForCalibration) {
            std::cout << "Method 2 - Gaussian blur (" << blurKernelSize << "x" << blurKernelSize << "): " 
                      << (found ? "SUCCESS" : "FAILED") << std::endl;
            if (found) {
                std::cout << "Found " << corners.size() << " corners after Gaussian blur" << std::endl;
            }
        }
    }
    
    // 方法3: 如果宽松方法失败，尝试无标志检测（最宽松）
    if (!found) {
        found = cv::findChessboardCorners(grayImage, boardSize, corners, 0);
        if (isForCalibration) {
            std::cout << "Method 3 - No flags detection: " << (found ? "SUCCESS" : "FAILED") << std::endl;
            if (found) {
                std::cout << "Found " << corners.size() << " corners with no flags" << std::endl;
            }
        }
    }
    
    // 方法4: 图像增强后检测（针对远距离低像素场景）
    if (!found) {
        cv::Mat enhancedImage;
        
        // 尝试锐化处理（对远距离场景有帮助）
        cv::Mat kernel = (cv::Mat_<float>(3,3) << 
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0);
        cv::filter2D(grayImage, enhancedImage, grayImage.depth(), kernel);
        
        found = cv::findChessboardCorners(enhancedImage, boardSize, corners, relaxed_flags);
        
        if (isForCalibration) {
            std::cout << "Method 4 - Enhanced (sharpened) image: " << (found ? "SUCCESS" : "FAILED") << std::endl;
            if (found) {
                std::cout << "Found " << corners.size() << " corners after sharpening" << std::endl;
                // 保存成功的增强图像
                std::string debugDir = "calibration_images/debug";
                cv::imwrite(debugDir + "/enhanced_success_sharp_" + std::to_string(time(nullptr)) + ".jpg", enhancedImage);
            }
        }
    }
    
    // 方法5: 对比度增强
    if (!found) {
        cv::Mat contrastImage;
        grayImage.convertTo(contrastImage, -1, 1.5, 0); // 增加对比度
        
        found = cv::findChessboardCorners(contrastImage, boardSize, corners, relaxed_flags);
        
        if (isForCalibration) {
            std::cout << "Method 5 - Contrast enhanced image: " << (found ? "SUCCESS" : "FAILED") << std::endl;
            if (found) {
                std::cout << "Found " << corners.size() << " corners after contrast enhancement" << std::endl;
            }
        }
    }
    
    // 如果是标定模式且仍然失败，尝试更多方法
    if (isForCalibration && !found) {
        
        // 方法6: 尝试反转棋盘格大小
        std::cout << "Method 6 - Trying with reversed board size..." << std::endl;
        cv::Size reversedSize(boardSize.height, boardSize.width);
        found = cv::findChessboardCorners(grayImage, reversedSize, corners, relaxed_flags);
        
        std::cout << "Reversed size " << reversedSize.width << "x" << reversedSize.height << ": " 
                  << (found ? "SUCCESS" : "FAILED") << std::endl;
        
        if (found) {
            std::cout << "IMPORTANT: Found chessboard with reversed size: " << reversedSize.width << "x" << reversedSize.height << std::endl;
            std::cout << "Please update your board size settings to " << reversedSize.width << "x" << reversedSize.height << std::endl;
        }
        
        // 方法7: 尝试常见的棋盘格大小
        if (!found) {
            std::cout << "Method 7 - Trying common board sizes..." << std::endl;
            std::vector<cv::Size> commonSizes = {
                cv::Size(7, 4),   // 8x5棋盘格的角点
                cv::Size(6, 4),   // 7x5棋盘格的角点  
                cv::Size(9, 6),   // 10x7棋盘格的角点
                cv::Size(6, 9),   // 反转的10x7
                cv::Size(4, 6),   // 反转的7x5
                cv::Size(4, 7),   // 反转的8x5
                cv::Size(5, 7),   // 6x8棋盘格的角点
                cv::Size(7, 5),   // 8x6棋盘格的角点
            };
            
            for (const auto& size : commonSizes) {
                if (size.width == boardSize.width && size.height == boardSize.height) {
                    continue; // 跳过已经尝试过的大小
                }
                
                std::cout << "  Trying size: " << size.width << "x" << size.height << std::endl;
                found = cv::findChessboardCorners(grayImage, size, corners, relaxed_flags);
                
                if (found) {
                    std::cout << "SUCCESS with size " << size.width << "x" << size.height 
                              << " (found " << corners.size() << " corners)" << std::endl;
                    std::cout << "IMPORTANT: Please update your board size settings to " << size.width << "x" << size.height << std::endl;
                    break;
                }
            }
        }
        
        std::cout << "=== DETECTION SUMMARY ===" << std::endl;
        if (found) {
            std::cout << "SUCCESS: Found " << corners.size() << " corners" << std::endl;
        } else {
            std::cout << "FAILED: No chessboard detected with any method" << std::endl;
            std::cout << "Troubleshooting suggestions:" << std::endl;
            std::cout << "1. Check if your chessboard has " << boardSize.width << "x" << boardSize.height << " INTERNAL corners" << std::endl;
            std::cout << "2. Ensure good lighting without glare or shadows" << std::endl;
            std::cout << "3. Hold the board flat and fully visible" << std::endl;
            std::cout << "4. Try different board orientations" << std::endl;
            std::cout << "5. Check if board size settings match your actual board" << std::endl;
            std::cout << "6. For distant shots, try moving closer to the camera" << std::endl;
        }
        std::cout << "=================================" << std::endl;
    }
    
    // 如果找到了棋盘格，进行宽松的亚像素级角点检测
    if (found) {
        // 使用更宽松的亚像素参数，适合远距离场景
        cv::cornerSubPix(grayImage, corners, cv::Size(5, 5), cv::Size(-1, -1),
            cv::TermCriteria(cv::TermCriteria::EPS + cv::TermCriteria::COUNT, 20, 0.3));
    }
    
    return found;
}

bool CameraCalibrator::addCalibrationImage(const cv::Mat& image) {
    // 设置或验证图像尺寸
    if (imageSize.empty()) {
        imageSize = image.size();
        std::cout << "First calibration image, setting size to: " << imageSize.width << "x" << imageSize.height << std::endl;
    } else if (imageSize != image.size()) {
        std::cerr << "Image size does not match previous images!" << std::endl;
        return false;
    }
    
    std::cout << "Trying to find chessboard with size: " << boardSize.width << "x" << boardSize.height << std::endl;
    std::cout << "Image size: " << image.cols << "x" << image.rows << ", channels: " << image.channels() << std::endl;
    
    // 保存原始图像用于调试
    std::string debugDir = "calibration_images/debug";
    system("mkdir -p calibration_images/debug");
    cv::imwrite(debugDir + "/original_" + std::to_string(time(nullptr)) + ".jpg", image);
    
    std::vector<cv::Point2f> corners;
    
    // 使用公共检测方法
    bool found = detectChessboard(image, corners, true);
    
    if (found) {
        std::cout << "Chessboard found with " << corners.size() << " corners!" << std::endl;
            
        imagePoints.push_back(corners);
        
        // 如果这是第一张图片，计算物体点
        if (imagePoints.size() == 1) {
            calculateObjectPoints();
        } else if (objectPoints.size() == 1) {
            // 复制物体点与图像数量相同
            objectPoints.resize(imagePoints.size(), objectPoints[0]);
        }
        
        std::cout << "Total calibration images: " << imagePoints.size() << std::endl;
        
        // 可选：保存标定图像（用于调试或记录）
        if (saveCalibrationImages) {
            std::cout << "Saving calibration image (saveCalibrationImages=" << (saveCalibrationImages ? "true" : "false") << ")" << std::endl;
            
            // 确保目录存在
            std::string dirCmd = "mkdir -p calibration_images";
            int dirResult = system(dirCmd.c_str());
            std::cout << "Directory creation result: " << dirResult << std::endl;
            
            std::string filename = "calibration_images/calib_" + 
                                 std::to_string(imagePoints.size()) + ".jpg";
            
            // 在图像上绘制检测到的角点
            cv::Mat imageWithCorners = image.clone();
            cv::drawChessboardCorners(imageWithCorners, boardSize, corners, found);
            
            // 检查目录权限
            system("ls -la calibration_images/");
            
            // 保存图像
            std::cout << "Trying to save image to: " << filename << std::endl;
            bool writeSuccess = cv::imwrite(filename, imageWithCorners);
            if (writeSuccess) {
                std::cout << "Successfully saved calibration image: " << filename << std::endl;
            } else {
                std::cerr << "Failed to save calibration image: " << filename << std::endl;
                // 尝试使用绝对路径
                std::string absFilename = "/home/radxa/Qworkspace/VideoMapping/calibration_images/calib_" + 
                                       std::to_string(imagePoints.size()) + ".jpg";
                std::cout << "Trying with absolute path: " << absFilename << std::endl;
                writeSuccess = cv::imwrite(absFilename, imageWithCorners);
                if (writeSuccess) {
                    std::cout << "Successfully saved with absolute path!" << std::endl;
                } else {
                    std::cerr << "Still failed with absolute path." << std::endl;
                    
                    // 尝试保存原始图像，看看是否是角点绘制的问题
                    std::string rawFilename = "/home/radxa/Qworkspace/VideoMapping/calibration_images/raw_" + 
                                           std::to_string(imagePoints.size()) + ".jpg";
                    bool rawSuccess = cv::imwrite(rawFilename, image);
                    std::cout << "Saving raw image: " << (rawSuccess ? "success" : "failed") << std::endl;
                }
            }
        } else {
            std::cout << "Not saving calibration image (saveCalibrationImages=false)" << std::endl;
        }
        
        return true;
    } else {
        std::cout << "No chessboard found in this image after trying all methods." << std::endl;
        std::cout << "Troubleshooting tips:" << std::endl;
        std::cout << "1. Ensure the chessboard is fully visible in the image" << std::endl;
        std::cout << "2. Check lighting conditions - avoid glare and shadows" << std::endl;
        std::cout << "3. Verify the chessboard size settings match your actual board" << std::endl;
        std::cout << "4. Try holding the board at different angles" << std::endl;
        std::cout << "5. Check if the board is flat and not bent" << std::endl;
        
        // 保存失败的图像以便调试
        std::string failedFilename = "/home/radxa/Qworkspace/VideoMapping/calibration_images/failed_" + 
                                  std::to_string(time(nullptr)) + ".jpg";
        cv::imwrite(failedFilename, image);
        std::cout << "Saved failed detection image to: " << failedFilename << std::endl;
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
