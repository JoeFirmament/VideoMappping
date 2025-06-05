#include "CameraCalibrator.h"
#include <opencv2/calib3d.hpp>
#include <iostream>
#include <ctime>  // 添加time.h头文件
#include <filesystem>  // 添加文件系统支持
#include <regex>       // 添加正则表达式支持
#include <iomanip>     // 添加iomanip头文件
#include <limits>      // 添加limits头文件

CameraCalibrator::CameraCalibrator() 
    : boardSize(8, 5)  // 默认9x6的棋盘格，角点数是8x5
    , squareSize(0.030f)  // 默认30mm
    , calibrated(false)
    , totalError(0.0)
    , imageSize(0, 0)  // 初始化为空尺寸
    , saveCalibrationImages(false)  // 默认不保存图像
    , nextImageNumber(1)  // 初始化下一个图片编号
    , blurKernelSize(5)  // 默认5x5高斯模糊核
    , qualityCheckLevel(BALANCED)  // 默认平衡模式
{
    // 在未标定状态下，保持矩阵为空，避免使用无效的默认值
    // 这样可以确保只有在真正完成标定后才有有效的标定参数
    cameraMatrix = cv::Mat();  // 空矩阵
    distCoeffs = cv::Mat();    // 空矩阵
    
    // 初始化时扫描已有的标定图片数量
    initializeExistingImageCount();
}

void CameraCalibrator::initializeExistingImageCount() {
    try {
        std::string calibDir = "calibration_images";
        
        // 确保目录存在
        if (!std::filesystem::exists(calibDir)) {
            std::cout << "Calibration images directory does not exist, creating..." << std::endl;
            std::filesystem::create_directories(calibDir);
            return;
        }
        
        // 扫描目录中的图片文件
        std::regex calibImagePattern(R"(calib_(\d+)\.jpg)");
        std::smatch match;
        int maxImageNumber = 0;
        int imageCount = 0;
        
        for (const auto& entry : std::filesystem::directory_iterator(calibDir)) {
            if (entry.is_regular_file()) {
                std::string filename = entry.path().filename().string();
                if (std::regex_search(filename, match, calibImagePattern)) {
                    imageCount++;
                    int number = std::stoi(match[1].str());
                    maxImageNumber = std::max(maxImageNumber, number);
                }
            }
        }
        
        // 不再创建空的占位向量！只是统计数量用于显示
        // imagePoints 和 objectPoints 保持为空，只有真正检测成功的图片才添加
        
        std::cout << "Found " << imageCount << " existing calibration images (max number: " 
                  << maxImageNumber << ")" << std::endl;
        std::cout << "Note: Only successfully detected images will be used for calibration" << std::endl;
                  
        // 更新下一个图片的编号
        nextImageNumber = maxImageNumber + 1;
        
    } catch (const std::exception& e) {
        std::cerr << "Error scanning existing calibration images: " << e.what() << std::endl;
        nextImageNumber = 1;
    }
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
    
    if (isForCalibration) {
        std::cout << "=== CHESSBOARD DETECTION DEBUG ===" << std::endl;
        std::cout << "Image size: " << image.cols << "x" << image.rows << std::endl;
        std::cout << "Image channels: " << image.channels() << std::endl;
        std::cout << "Target board size: " << boardSize.width << "x" << boardSize.height << " corners" << std::endl;
        std::cout << "Expected corner count: " << (boardSize.width * boardSize.height) << std::endl;
    }
    
    bool found = false;
    
    // 方法1: 使用宽松的检测参数 - 最常用，成功率最高
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
    
    // ✅ 如果第一次检测成功，立即进行亚像素精度优化并返回
    if (found) {
        if (isForCalibration) {
            std::cout << "✅ SUCCESS on first attempt - skipping other methods for efficiency" << std::endl;
        }
        // 亚像素精度优化
        cv::cornerSubPix(grayImage, corners, cv::Size(5, 5), cv::Size(-1, -1),
            cv::TermCriteria(cv::TermCriteria::EPS + cv::TermCriteria::COUNT, 20, 0.3));
        return true;
    }
    
    // 方法2: 增强的预处理（仅在第一次失败时尝试）
    cv::Mat enhancedImage = preprocessImage(image);
    cv::Mat enhancedGray;
    if (enhancedImage.channels() == 3) {
        cv::cvtColor(enhancedImage, enhancedGray, cv::COLOR_BGR2GRAY);
    } else {
        enhancedGray = enhancedImage.clone();
    }
    
    found = cv::findChessboardCorners(enhancedGray, boardSize, corners, relaxed_flags);
    
    if (isForCalibration) {
        std::cout << "Method 2 - Enhanced preprocessing: " << (found ? "SUCCESS" : "FAILED") << std::endl;
    }
    
    if (found) {
        cv::cornerSubPix(enhancedGray, corners, cv::Size(5, 5), cv::Size(-1, -1),
            cv::TermCriteria(cv::TermCriteria::EPS + cv::TermCriteria::COUNT, 20, 0.3));
        return true;
    }
    
    // 方法3: 无标志检测（最宽松）
    found = cv::findChessboardCorners(grayImage, boardSize, corners, 0);
    if (isForCalibration) {
        std::cout << "Method 3 - No flags detection: " << (found ? "SUCCESS" : "FAILED") << std::endl;
    }
    
    if (found) {
        cv::cornerSubPix(grayImage, corners, cv::Size(5, 5), cv::Size(-1, -1),
            cv::TermCriteria(cv::TermCriteria::EPS + cv::TermCriteria::COUNT, 20, 0.3));
        return true;
    }
    
    // 仅在标定模式下才执行更耗时的方法
    if (isForCalibration) {
        // 方法4: 图像锐化
        cv::Mat sharpened;
        cv::Mat kernel = (cv::Mat_<float>(3,3) << 
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0);
        cv::filter2D(grayImage, sharpened, grayImage.depth(), kernel);
        
        found = cv::findChessboardCorners(sharpened, boardSize, corners, relaxed_flags);
        std::cout << "Method 4 - Enhanced (sharpened) image: " << (found ? "SUCCESS" : "FAILED") << std::endl;
        
        if (found) {
            cv::cornerSubPix(sharpened, corners, cv::Size(5, 5), cv::Size(-1, -1),
                cv::TermCriteria(cv::TermCriteria::EPS + cv::TermCriteria::COUNT, 20, 0.3));
            return true;
        }
        
        // 方法5: 对比度增强
        cv::Mat contrast;
        grayImage.convertTo(contrast, -1, 1.5, 0);
        
        found = cv::findChessboardCorners(contrast, boardSize, corners, relaxed_flags);
        std::cout << "Method 5 - Contrast enhanced image: " << (found ? "SUCCESS" : "FAILED") << std::endl;
        
        if (found) {
            cv::cornerSubPix(contrast, corners, cv::Size(5, 5), cv::Size(-1, -1),
                cv::TermCriteria(cv::TermCriteria::EPS + cv::TermCriteria::COUNT, 20, 0.3));
            return true;
        }
        
        std::cout << "=== DETECTION FAILED ===" << std::endl;
        std::cout << "Troubleshooting suggestions:" << std::endl;
        std::cout << "1. Check if chessboard has " << boardSize.width << "x" << boardSize.height << " internal corners" << std::endl;
        std::cout << "2. Ensure good lighting without glare" << std::endl;
        std::cout << "3. Hold the board flat and fully visible" << std::endl;
        std::cout << "4. Try different orientations" << std::endl;
    }
    
    return false;
}

bool CameraCalibrator::addCalibrationImage(const cv::Mat& image) {
    std::cout << "\n=== CameraCalibrator::addCalibrationImage() START ===" << std::endl;
    std::cout << "Current session image count before adding: " << imagePoints.size() << std::endl;
    std::cout << "Input image size: " << image.cols << "x" << image.rows << std::endl;
    
    if (image.empty()) {
        std::cerr << "❌ Error: Input image is empty!" << std::endl;
        return false;
    }
    
    // 检查图像类型和通道数
    if (image.type() != CV_8UC3 && image.type() != CV_8UC1) {
        std::cerr << "❌ Error: Unsupported image type: " << image.type() << std::endl;
        return false;
    }
    
    std::cout << "Image type: " << image.type() << " (CV_8UC3=" << CV_8UC3 << ", CV_8UC1=" << CV_8UC1 << ")" << std::endl;
    
    // 1. 图像预处理
    cv::Mat processedImage = preprocessImage(image);
    std::cout << "Image preprocessing completed" << std::endl;
    
    // 2. 检测棋盘格角点
    std::vector<cv::Point2f> corners;
    bool found = cv::findChessboardCorners(processedImage, boardSize, corners,
                                         cv::CALIB_CB_ADAPTIVE_THRESH | 
                                         cv::CALIB_CB_NORMALIZE_IMAGE | 
                                         cv::CALIB_CB_FAST_CHECK);
    
    std::cout << "Initial chessboard detection: " << (found ? "SUCCESS" : "FAILED") << std::endl;
    
    if (!found) {
        std::cout << "❌ No chessboard corners found in image" << std::endl;
        std::cout << "Expected board size: " << boardSize.width << "x" << boardSize.height << std::endl;
        return false;
    }
    
    std::cout << "Found " << corners.size() << " corners (expected: " << (boardSize.width * boardSize.height) << ")" << std::endl;
    
    // 3. 亚像素精度优化
    cv::Mat gray;
    if (processedImage.channels() == 3) {
        cv::cvtColor(processedImage, gray, cv::COLOR_BGR2GRAY);
    } else {
        gray = processedImage.clone();
    }
    
    cv::cornerSubPix(gray, corners, cv::Size(11, 11), cv::Size(-1, -1), 
                    cv::TermCriteria(cv::TermCriteria::EPS + cv::TermCriteria::COUNT, 30, 0.01));
    std::cout << "Corner subpixel refinement completed" << std::endl;
    
    // 4. 图像质量评估
    ImageQualityMetrics metrics = evaluateImageQuality(processedImage, corners);
    std::cout << "Image quality evaluation:" << std::endl;
    std::cout << "  - Quality level: " << metrics.qualityLevel << std::endl;
    std::cout << "  - Sharpness: " << metrics.sharpness << std::endl;
    std::cout << "  - Brightness: " << metrics.brightness << std::endl;
    std::cout << "  - Contrast: " << metrics.contrast << std::endl;
    std::cout << "  - Corner confidence: " << metrics.cornerConfidence << std::endl;
    std::cout << "  - Is valid: " << (metrics.isValid ? "YES" : "NO") << std::endl;
    
    if (!shouldAcceptImage(metrics)) {
        std::cout << "❌ Image quality check FAILED - image rejected" << std::endl;
        
        // 显示具体的拒绝原因
        if (qualityCheckLevel == STRICT) {
            double minSharpness = 40.0, minBrightness = 50.0, minContrast = 25.0;
            double minCornerConfidence = 0.8, minBoardCoverage = 0.15;
            
            if (metrics.sharpness < minSharpness) {
                std::cout << "  - 清晰度不足 (" << metrics.sharpness << " < " << minSharpness << ")" << std::endl;
            }
            if (metrics.brightness < minBrightness) {
                std::cout << "  - 亮度不足 (" << metrics.brightness << " < " << minBrightness << ")" << std::endl;
            }
            if (metrics.contrast < minContrast) {
                std::cout << "  - 对比度不足 (" << metrics.contrast << " < " << minContrast << ")" << std::endl;
            }
            if (metrics.cornerConfidence < minCornerConfidence) {
                std::cout << "  - 角点检测置信度不足 (" << metrics.cornerConfidence << " < " << minCornerConfidence << ")" << std::endl;
            }
            if (metrics.boardCoverage < minBoardCoverage) {
                std::cout << "  - 棋盘格太小 (" << metrics.boardCoverage << " < " << minBoardCoverage << ")" << std::endl;
            }
        } else if (qualityCheckLevel == BALANCED) {
            double minSharpness = 25.0, minBrightness = 30.0, minContrast = 15.0;
            double minCornerConfidence = 0.6, minBoardCoverage = 0.10;
            
            if (metrics.sharpness < minSharpness) {
                std::cout << "  - 清晰度不足 (" << metrics.sharpness << " < " << minSharpness << ")" << std::endl;
            }
            if (metrics.brightness < minBrightness) {
                std::cout << "  - 亮度不足 (" << metrics.brightness << " < " << minBrightness << ")" << std::endl;
            }
            if (metrics.contrast < minContrast) {
                std::cout << "  - 对比度不足 (" << metrics.contrast << " < " << minContrast << ")" << std::endl;
            }
            if (metrics.cornerConfidence < minCornerConfidence) {
                std::cout << "  - 角点检测置信度不足 (" << metrics.cornerConfidence << " < " << minCornerConfidence << ")" << std::endl;
            }
            if (metrics.boardCoverage < minBoardCoverage) {
                std::cout << "  - 棋盘格太小 (" << metrics.boardCoverage << " < " << minBoardCoverage << ")" << std::endl;
            }
        } else { // PERMISSIVE
            double minSharpness = 15.0, minBrightness = 20.0, minContrast = 8.0;
            double minCornerConfidence = 0.4, minBoardCoverage = 0.05;
            
            if (metrics.sharpness < minSharpness) {
                std::cout << "  - 清晰度不足 (" << metrics.sharpness << " < " << minSharpness << ")" << std::endl;
            }
            if (metrics.brightness < minBrightness) {
                std::cout << "  - 亮度不足 (" << metrics.brightness << " < " << minBrightness << ")" << std::endl;
            }
            if (metrics.contrast < minContrast) {
                std::cout << "  - 对比度不足 (" << metrics.contrast << " < " << minContrast << ")" << std::endl;
            }
            if (metrics.cornerConfidence < minCornerConfidence) {
                std::cout << "  - 角点检测置信度不足 (" << metrics.cornerConfidence << " < " << minCornerConfidence << ")" << std::endl;
            }
            if (metrics.boardCoverage < minBoardCoverage) {
                std::cout << "  - 棋盘格太小 (" << metrics.boardCoverage << " < " << minBoardCoverage << ")" << std::endl;
            }
        }
        
        return false;
    }
    
    std::cout << "✅ Image quality check PASSED!" << std::endl;
        
    // 5. 设置图像尺寸（如果还没有设置）
    if (imageSize.width == 0 || imageSize.height == 0) {
        imageSize = cv::Size(image.cols, image.rows);
        std::cout << "Image size set to: " << imageSize.width << "x" << imageSize.height << std::endl;
    }
    
    // 6. 添加到标定数据中
    size_t countBeforeAdd = imagePoints.size();
    imagePoints.push_back(corners);
    size_t countAfterAdd = imagePoints.size();
    
    std::cout << "Image points added to collection:" << std::endl;
    std::cout << "  - Count before: " << countBeforeAdd << std::endl;
    std::cout << "  - Count after: " << countAfterAdd << std::endl;
    
    // 确保每张图片都有对应的物体点
    if (objectPoints.empty()) {
        // 第一次添加时，创建物体点模板
        calculateObjectPoints();
        std::cout << "Object points calculated for first image" << std::endl;
    }
    
    // 确保objectPoints数量与imagePoints匹配
    while (objectPoints.size() < imagePoints.size()) {
        if (objectPoints.empty()) {
            calculateObjectPoints();
        } else {
            objectPoints.push_back(objectPoints[0]);  // 复制第一个物体点
        }
    }
    
    std::cout << "Object points synchronized - imagePoints: " << imagePoints.size() 
              << ", objectPoints: " << objectPoints.size() << std::endl;
    
    std::cout << "Total valid calibration images now: " << imagePoints.size() << std::endl;
    
    // 6. 保存高质量标定图像到磁盘
    if (saveCalibrationImages) {
        std::cout << "Saving calibration image to disk..." << std::endl;
        
        // 确保目录存在
        std::string dirCmd = "mkdir -p calibration_images";
        int dirResult = system(dirCmd.c_str());
        
        std::string filename = "calibration_images/calib_" + 
                             std::to_string(nextImageNumber) + ".jpg";
        
        // 在图像上绘制检测到的角点
        cv::Mat imageWithCorners = image.clone();
        cv::drawChessboardCorners(imageWithCorners, boardSize, corners, found);
        
        // 添加质量信息到图像上
        std::string qualityText = metrics.qualityLevel + " (Sharp:" + 
                                std::to_string(int(metrics.sharpness)) + 
                                " Conf:" + std::to_string(int(metrics.cornerConfidence * 100)) + "%)";
        cv::putText(imageWithCorners, qualityText, cv::Point(10, 30), 
                   cv::FONT_HERSHEY_SIMPLEX, 0.8, cv::Scalar(0, 255, 0), 2);
        
        // 保存图像
        std::cout << "Trying to save image to: " << filename << std::endl;
        bool writeSuccess = cv::imwrite(filename, imageWithCorners);
        if (writeSuccess) {
            std::cout << "✅ Successfully saved calibration image: " << filename << std::endl;
            nextImageNumber++; // 保存成功后递增编号
        } else {
            std::cerr << "❌ Failed to save calibration image: " << filename << std::endl;
            std::cout << "=== CameraCalibrator::addCalibrationImage() END (SAVE FAILED) ===" << std::endl;
            return false;
        }
    } else {
        std::cout << "Image saving is disabled (saveCalibrationImages = false)" << std::endl;
    }
    
    std::cout << "=== CameraCalibrator::addCalibrationImage() END (SUCCESS) ===" << std::endl;
    std::cout << "Final session image count: " << imagePoints.size() << std::endl;
    return true;
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
    
    std::cout << "=== STARTING CALIBRATION PROCESS ===" << std::endl;
    std::cout << "Initial image count: " << imagePoints.size() << std::endl;
    
    // 1. 过滤无效图片
    filterCalibrationImages();
    
    if (imagePoints.empty()) {
        std::cerr << "No valid images remain after filtering!" << std::endl;
        return false;
    }
    
    if (imagePoints.size() < 5) {
        std::cerr << "Not enough valid images for calibration (need at least 5, have " 
                  << imagePoints.size() << ")" << std::endl;
        return false;
    }
    
    // 2. 确保objectPoints和imagePoints数量匹配
    if (objectPoints.size() != imagePoints.size()) {
        std::cout << "Regenerating objectPoints to match imagePoints..." << std::endl;
        std::cout << "imagePoints.size(): " << imagePoints.size() << std::endl;
        std::cout << "objectPoints.size(): " << objectPoints.size() << std::endl;
        
        // 重新生成objectPoints以匹配imagePoints数量
        objectPoints.clear();
        for (size_t i = 0; i < imagePoints.size(); ++i) {
            std::vector<cv::Point3f> corners;
            for (int row = 0; row < boardSize.height; ++row) {
                for (int col = 0; col < boardSize.width; ++col) {
                    corners.push_back(cv::Point3f(col * squareSize, row * squareSize, 0));
                }
            }
            objectPoints.push_back(corners);
        }
        std::cout << "Regenerated objectPoints.size(): " << objectPoints.size() << std::endl;
    }
    
    // 3. 最终验证数据完整性
    bool hasInvalidData = false;
    for (size_t i = 0; i < imagePoints.size(); ++i) {
        if (imagePoints[i].empty()) {
            std::cerr << "Found empty imagePoints at index " << i << std::endl;
            hasInvalidData = true;
        }
        if (i < objectPoints.size() && objectPoints[i].empty()) {
            std::cerr << "Found empty objectPoints at index " << i << std::endl;
            hasInvalidData = true;
        }
        if (imagePoints[i].size() != boardSize.width * boardSize.height) {
            std::cerr << "Incorrect corner count at index " << i 
                      << ": " << imagePoints[i].size() 
                      << " (expected " << (boardSize.width * boardSize.height) << ")" << std::endl;
            hasInvalidData = true;
        }
    }
    
    if (hasInvalidData) {
        std::cerr << "Invalid data detected, calibration cannot proceed!" << std::endl;
        return false;
    }
    
    std::vector<cv::Mat> rvecs, tvecs;
    int flags = cv::CALIB_FIX_ASPECT_RATIO; // 使用更稳定的标定参数
    
    // 4. 验证图像尺寸
    if (imageSize.empty()) {
        std::cerr << "Image size is not set!" << std::endl;
        return false;
    }
    
    std::cout << "=== CALIBRATION PARAMETERS ===" << std::endl;
    std::cout << "Valid images: " << imagePoints.size() << std::endl;
    std::cout << "Board size: " << boardSize.width << "x" << boardSize.height << " corners" << std::endl;
    std::cout << "Square size: " << squareSize << " meters" << std::endl;
    std::cout << "Image size: " << imageSize.width << "x" << imageSize.height << std::endl;
    std::cout << "Expected corners per image: " << (boardSize.width * boardSize.height) << std::endl;
    
    // 5. 执行标定
    std::cout << "Starting camera calibration..." << std::endl;
    try {
        totalError = cv::calibrateCamera(objectPoints, imagePoints, 
                                       imageSize, 
                                       cameraMatrix, distCoeffs, 
                                       rvecs, tvecs, flags);
        calibrated = true;
        
        // 6. 计算详细的重投影误差统计
        double totalSquaredError = 0.0;
        int totalPoints = 0;
        double maxError = 0.0;
        double minError = std::numeric_limits<double>::max();
        std::vector<double> perImageErrors;
        
        for (size_t i = 0; i < objectPoints.size(); ++i) {
            std::vector<cv::Point2f> projected_points;
            cv::projectPoints(objectPoints[i], rvecs[i], tvecs[i], 
                             cameraMatrix, distCoeffs, projected_points);
                             
            double imageError = cv::norm(cv::Mat(imagePoints[i]), cv::Mat(projected_points), cv::NORM_L2);
            double perPointError = imageError / objectPoints[i].size();
            
            perImageErrors.push_back(perPointError);
            totalSquaredError += imageError * imageError;
            totalPoints += objectPoints[i].size();
            
            maxError = std::max(maxError, perPointError);
            minError = std::min(minError, perPointError);
        }
        
        totalError = std::sqrt(totalSquaredError / totalPoints);
        
        std::cout << "=== CALIBRATION RESULTS ===" << std::endl;
        std::cout << "✅ Calibration completed successfully!" << std::endl;
        std::cout << "Average re-projection error: " << std::fixed << std::setprecision(4) 
                  << totalError << " pixels" << std::endl;
        std::cout << "Min error: " << std::fixed << std::setprecision(4) << minError << " pixels" << std::endl;
        std::cout << "Max error: " << std::fixed << std::setprecision(4) << maxError << " pixels" << std::endl;
        
        // 质量评估
        if (totalError < 1.0) {
            std::cout << "🌟 Calibration quality: EXCELLENT" << std::endl;
        } else if (totalError < 2.0) {
            std::cout << "👍 Calibration quality: GOOD" << std::endl;
        } else {
            std::cout << "⚠️  Calibration quality: NEEDS IMPROVEMENT" << std::endl;
        }
        
        std::cout << "Camera matrix:" << std::endl << cameraMatrix << std::endl;
        std::cout << "Distortion coefficients:" << std::endl << distCoeffs << std::endl;
        
        return true;
        
    } catch (const cv::Exception& e) {
        std::cerr << "OpenCV calibration error: " << e.what() << std::endl;
        calibrated = false;
        return false;
    }
}

bool CameraCalibrator::saveCalibrationData(const std::string& filename) {
    if (!calibrated) {
        std::cerr << "Camera is not calibrated yet!" << std::endl;
        return false;
    }
    
    std::cout << "=== SAVING CAMERA CALIBRATION DATA ===" << std::endl;
    std::cout << "Target file: " << filename << std::endl;
    
    // 确保目录存在
    std::filesystem::path filePath(filename);
    std::filesystem::path dirPath = filePath.parent_path();
    
    if (!dirPath.empty()) {
        try {
            std::filesystem::create_directories(dirPath);
            std::cout << "Directory created/verified: " << dirPath << std::endl;
        } catch (const std::exception& e) {
            std::cerr << "Failed to create directory: " << e.what() << std::endl;
            return false;
        }
    }
    
    try {
        cv::FileStorage fs(filename, cv::FileStorage::WRITE);
        if (!fs.isOpened()) {
            std::cerr << "Failed to open file: " << filename << std::endl;
            return false;
        }
        
        std::cout << "Writing calibration parameters..." << std::endl;
        fs << "camera_matrix" << cameraMatrix;
        fs << "dist_coeffs" << distCoeffs;
        fs << "board_width" << boardSize.width;
        fs << "board_height" << boardSize.height;
        fs << "square_size" << squareSize;
        fs << "avg_reprojection_error" << totalError;
        
        // 添加时间戳和图像数量信息
        std::time_t currentTime = std::time(nullptr);
        fs << "calibration_date" << std::ctime(&currentTime);
        fs << "image_count" << (int)imagePoints.size();
        
        fs.release();
        std::cout << "✅ Camera calibration data saved successfully to: " << filename << std::endl;
        return true;
        
    } catch (const cv::Exception& e) {
        std::cerr << "OpenCV error while saving: " << e.what() << std::endl;
        return false;
    } catch (const std::exception& e) {
        std::cerr << "Error while saving: " << e.what() << std::endl;
        return false;
    }
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
    
    // 验证输入图像
    if (image.empty()) {
        std::cerr << "Error: Input image is empty for undistortion!" << std::endl;
        return image;
    }
    
    // 验证标定参数的有效性
    if (cameraMatrix.empty() || distCoeffs.empty()) {
        std::cerr << "Error: Camera matrix or distortion coefficients are empty!" << std::endl;
        return image;
    }
    
    // 验证相机矩阵的尺寸和类型
    if (cameraMatrix.rows != 3 || cameraMatrix.cols != 3 || cameraMatrix.type() != CV_64F) {
        std::cerr << "Error: Invalid camera matrix size or type!" << std::endl;
        return image;
    }
    
    // 验证畸变系数的类型
    if (distCoeffs.type() != CV_64F) {
        std::cerr << "Error: Invalid distortion coefficients type!" << std::endl;
        return image;
    }
    
    try {
        cv::Mat undistorted;
        cv::undistort(image, undistorted, cameraMatrix, distCoeffs);
        
        // 验证去畸变结果
        if (undistorted.empty()) {
            std::cerr << "Error: Undistortion resulted in empty image!" << std::endl;
            return image;
        }
        
        return undistorted;
    } catch (const cv::Exception& e) {
        std::cerr << "OpenCV error in undistortImage: " << e.what() << std::endl;
        return image; // 返回原始图像作为备用
    } catch (const std::exception& e) {
        std::cerr << "Error in undistortImage: " << e.what() << std::endl;
        return image; // 返回原始图像作为备用
    }
}

// 图像质量评估实现
CameraCalibrator::ImageQualityMetrics CameraCalibrator::evaluateImageQuality(
    const cv::Mat& image, const std::vector<cv::Point2f>& corners) {
    
    ImageQualityMetrics metrics;
    cv::Mat grayImage;
    
    // 转换为灰度图
    if (image.channels() == 3) {
        cv::cvtColor(image, grayImage, cv::COLOR_BGR2GRAY);
    } else {
        grayImage = image.clone();
    }
    
    // 1. 清晰度评估（拉普拉斯方差）
    cv::Mat laplacian;
    cv::Laplacian(grayImage, laplacian, CV_64F);
    cv::Scalar mean, stddev;
    cv::meanStdDev(laplacian, mean, stddev);
    metrics.sharpness = stddev.val[0] * stddev.val[0];  // 方差作为清晰度指标
    
    // 2. 亮度评估
    cv::Scalar meanBrightness = cv::mean(grayImage);
    metrics.brightness = meanBrightness.val[0];
    
    // 3. 对比度评估
    cv::meanStdDev(grayImage, mean, stddev);
    metrics.contrast = stddev.val[0];
    
    // 4. 角点检测置信度（基于角点分布的均匀性）
    if (!corners.empty()) {
        // 计算角点分布的均匀性
        cv::Rect imageRect(0, 0, image.cols, image.rows);
        std::vector<cv::Point2f> validCorners;
        
        for (const auto& corner : corners) {
            if (imageRect.contains(corner)) {
                validCorners.push_back(corner);
            }
        }
        
        if (validCorners.size() == boardSize.width * boardSize.height) {
            metrics.cornerConfidence = 1.0;  // 检测到所有期望的角点
        } else {
            metrics.cornerConfidence = double(validCorners.size()) / (boardSize.width * boardSize.height);
        }
        
        // 5. 棋盘格覆盖率（棋盘格在图像中的大小）
        if (!validCorners.empty()) {
            cv::Rect boundingRect = cv::boundingRect(validCorners);
            double imageArea = image.cols * image.rows;
            double boardArea = boundingRect.width * boundingRect.height;
            metrics.boardCoverage = boardArea / imageArea;
            
            // 6. 倾斜角度评估 - 修复计算逻辑
            if (validCorners.size() >= 4) {
                // 使用棋盘格的第一行来计算倾斜角度
                cv::Point2f topLeft = validCorners[0];
                cv::Point2f topRight = validCorners[boardSize.width - 1];
                
                // 计算水平线的倾斜角度
                double dx = topRight.x - topLeft.x;
                double dy = topRight.y - topLeft.y;
                double angle = std::atan2(dy, dx) * 180.0 / CV_PI;
                
                // 将角度归一化到0-90度范围
                angle = std::abs(angle);
                if (angle > 90.0) {
                    angle = 180.0 - angle;
                }
                if (angle > 45.0) {
                    angle = 90.0 - angle;
                }
                
                metrics.skewAngle = angle;
            } else {
                metrics.skewAngle = 0.0;
            }
        } else {
            metrics.boardCoverage = 0.0;
            metrics.skewAngle = 90.0;  // 最差情况
        }
    } else {
        metrics.cornerConfidence = 0.0;
        metrics.boardCoverage = 0.0;
        metrics.skewAngle = 90.0;
    }
    
    // 综合质量评估
    metrics.isValid = shouldAcceptImage(metrics);
    
    // ========================================================================
    // 远距离标定专用评分系统
    // ========================================================================
    // 设计理念：角点置信度是核心，其他指标作为质量参考
    // 适用场景：工业远距离标定，小覆盖率，注重检测稳定性
    // 评分重点：准确性 > 完美性，实用性 > 理想性
    // ========================================================================
    
    double qualityScore = 0.0;
    
    // === 核心评分：角点置信度 (70分) ===
    // 这是远距离标定成功的决定性因素
    qualityScore += metrics.cornerConfidence * 70;
    
    // === 辅助评分：图像质量 (30分) ===
    // 为图像质量提供参考，但不影响接受决策
    
    // 清晰度 (12分) - 远距离下降低期望
    if (metrics.sharpness >= 25) {
        qualityScore += 12;
    } else if (metrics.sharpness >= 15) {
        qualityScore += (metrics.sharpness / 25.0) * 12;
    }
    
    // 亮度适宜性 (10分) - 范围放宽
    if (metrics.brightness >= 40 && metrics.brightness <= 200) {
        qualityScore += 10;  // 远距离下的合理范围
    } else if (metrics.brightness >= 25 && metrics.brightness <= 230) {
        qualityScore += 7;   // 可接受范围
    } else if (metrics.brightness >= 15 && metrics.brightness <= 245) {
        qualityScore += 4;   // 勉强可用
    }
    
    // 对比度 (8分) - 要求降低
    if (metrics.contrast >= 15) {
        qualityScore += 8;
    } else if (metrics.contrast >= 8) {
        qualityScore += (metrics.contrast / 15.0) * 8;
    }
    
    // ========================================================================
    // 远距离场景特殊评级标准
    // ========================================================================
    // 重点：只要角点检测可靠，就是好图像
    // 原因：远距离下其他指标的重要性显著降低
    
    if (qualityScore >= 75) {
        metrics.qualityLevel = "excellent";  // 75分以上：角点置信度很高
    } else if (qualityScore >= 60) {
        metrics.qualityLevel = "good";       // 60分以上：角点置信度可靠
    } else if (qualityScore >= 45) {
        metrics.qualityLevel = "acceptable"; // 45分以上：勉强可用
    } else {
        metrics.qualityLevel = "poor";       // 45分以下：质量不足
    }
    
    // ========================================================================
    // 信息性指标显示（不计入评分）
    // ========================================================================
    // 在控制台显示倾斜角度和覆盖率信息，供用户参考
    // 但不影响图像接受决策和质量评分
    
    return metrics;
}

size_t CameraCalibrator::getImageCount() const {
    // 返回当前会话中成功添加的图像数量，这才是真正用于标定的图像数
    return imagePoints.size();
}

// 新增：会话管理方法实现
void CameraCalibrator::clearCurrentSession() {
    std::cout << "=== CLEARING CURRENT CALIBRATION SESSION ===" << std::endl;
    std::cout << "Clearing " << imagePoints.size() << " images from current session" << std::endl;
    
    // 清除当前会话的所有内存数据
    imagePoints.clear();
    objectPoints.clear();
    
    // 重置标定状态
    calibrated = false;
    totalError = 0.0;
    imageSize = cv::Size(0, 0);
    
    std::cout << "Current session cleared. Ready for new calibration session." << std::endl;
}

size_t CameraCalibrator::getCurrentSessionImageCount() const {
    // 返回当前会话中的图像数量（与getImageCount相同，但语义更清晰）
    return imagePoints.size();
}

void CameraCalibrator::startNewCalibrationSession() {
    std::cout << "=== STARTING NEW CALIBRATION SESSION ===" << std::endl;
    
    // 清除当前会话数据
    clearCurrentSession();
    
    // 可选：根据当前时间生成会话ID，用于文件命名
    std::time_t now = std::time(nullptr);
    std::string sessionId = std::to_string(now);
    
    std::cout << "New calibration session started (ID: " << sessionId << ")" << std::endl;
    std::cout << "All new images will be part of this session and used for calibration." << std::endl;
}

bool CameraCalibrator::shouldAcceptImage(const ImageQualityMetrics& metrics) {
    // ========================================================================
    // 远距离标定优化策略：
    // 1. 角点置信度是唯一的硬性要求 - 这是标定精度的根本保证
    // 2. 覆盖率要求极度宽松 - 远距离场景下棋盘本来就小
    // 3. 倾斜角度不限制 - 远距离下角度变化对标定影响很小
    // 4. 其他参数作为软性建议，不强制要求
    // ========================================================================
    
    double minCornerConfidence;  // 唯一的硬性要求
    
    switch (qualityCheckLevel) {
        case STRICT:
            minCornerConfidence = 0.85;  // 严格模式：85%角点置信度
            break;
            
        case BALANCED:
            minCornerConfidence = 0.75;  // 平衡模式：75%角点置信度
            break;
            
        case PERMISSIVE:
            minCornerConfidence = 0.65;  // 宽松模式：65%角点置信度
            break;
            
        default:
            minCornerConfidence = 0.75;  // 默认75%
            break;
    }
    
    // ========================================================================
    // 远距离标定核心策略：只关注角点置信度
    // ========================================================================
    
    // 硬性要求：角点置信度必须达标
    if (metrics.cornerConfidence < minCornerConfidence) {
        std::cout << "  - 角点置信度不足 (" << std::fixed << std::setprecision(3) 
                  << metrics.cornerConfidence << " < " << minCornerConfidence << ")" << std::endl;
        return false;
    }
    
    // ========================================================================
    // 软性指标检查（仅警告，不拒绝图像）
    // ========================================================================
    
    // 亮度检查（建议性）
    if (metrics.brightness < 20.0 || metrics.brightness > 240.0) {
        std::cout << "  ⚠️  亮度建议: " << std::fixed << std::setprecision(1) 
                  << metrics.brightness << " (建议范围: 20-240)" << std::endl;
    }
    
    // 清晰度检查（建议性）
    if (metrics.sharpness < 15.0) {
        std::cout << "  ⚠️  清晰度建议: " << std::fixed << std::setprecision(1) 
                  << metrics.sharpness << " (建议>15)" << std::endl;
    }
    
    // 对比度检查（建议性）
    if (metrics.contrast < 10.0) {
        std::cout << "  ⚠️  对比度建议: " << std::fixed << std::setprecision(1) 
                  << metrics.contrast << " (建议>10)" << std::endl;
    }
    
    // ========================================================================
    // 远距离场景：覆盖率和倾斜角度仅作信息显示，不影响接受决策
    // ========================================================================
    
    std::cout << "  ℹ️  覆盖率: " << std::fixed << std::setprecision(3) 
              << metrics.boardCoverage << " (" << (metrics.boardCoverage * 100) << "%)" << std::endl;
    std::cout << "  ℹ️  倾斜角度: " << std::fixed << std::setprecision(1) 
              << metrics.skewAngle << "°" << std::endl;
    
    // 接受图像：只要角点置信度达标即可
    return true;
}

cv::Mat CameraCalibrator::preprocessImage(const cv::Mat& image) {
    cv::Mat processed = image.clone();
    
    // ===============================================================
    // 恶劣环境下的棋盘格检测图像增强策略
    // ===============================================================
    // 目标：在低光照、高噪声、低对比度环境下提高角点检测成功率
    // 原理：多级渐进式增强，每个步骤解决特定问题
    // 适用场景：室内低光照、工业环境、远距离拍摄等恶劣条件
    // ===============================================================
    
    // === 第1级：亮度和局部对比度增强 ===
    // 问题：低光照导致整体偏暗，角点与背景对比度不足
    // 解决方案：CLAHE (Contrast Limited Adaptive Histogram Equalization)
    // 优点：局部自适应，避免过度增强；在LAB空间处理，保护色彩信息
    cv::Mat enhanced;
    if (processed.channels() == 3) {
        // 转换到LAB色彩空间：L通道控制亮度，A/B通道控制色彩
        cv::Mat lab;
        cv::cvtColor(processed, lab, cv::COLOR_BGR2Lab);
        
        std::vector<cv::Mat> lab_channels;
        cv::split(lab, lab_channels);
        
        // CLAHE参数调优：
        // - clipLimit=3.0: 适中的对比度限制，避免噪声放大
        // - tileGridSize=8x8: 小块处理，适应局部光照变化
        cv::Ptr<cv::CLAHE> clahe = cv::createCLAHE(3.0, cv::Size(8, 8)); 
        clahe->apply(lab_channels[0], lab_channels[0]);
        
        cv::merge(lab_channels, lab);
        cv::cvtColor(lab, enhanced, cv::COLOR_Lab2BGR);
    } else {
        // 灰度图像直接增强
        cv::Ptr<cv::CLAHE> clahe = cv::createCLAHE(3.0, cv::Size(8, 8));
        clahe->apply(processed, enhanced);
    }
    
    // === 第2级：伽马校正 - 非线性亮度提升 ===
    // 问题：暗部细节丢失，棋盘格黑色区域与背景难以区分
    // 解决方案：γ<1的伽马校正，优先提亮暗部
    // 优点：保持高亮区域不过曝，主要提升暗部可见性
    cv::Mat gamma_corrected;
    double gamma = 0.7; // 经验值：0.6-0.8适合低光照场景
    cv::Mat lookupTable(1, 256, CV_8U);
    uchar* p = lookupTable.ptr();
    for (int i = 0; i < 256; ++i) {
        p[i] = cv::saturate_cast<uchar>(pow(i / 255.0, gamma) * 255.0);
    }
    cv::LUT(enhanced, lookupTable, gamma_corrected);
    
    // === 第3级：智能去噪 - 双边滤波 ===
    // 问题：噪声干扰角点检测；传统高斯模糊会模糊边缘
    // 解决方案：双边滤波 - 去噪同时保护边缘信息
    // 优点：比高斯模糊更智能，专门保护角点边缘
    cv::Mat denoised;
    if (blurKernelSize > 0) {
        // 双边滤波参数说明：
        // - d=blurKernelSize: 邻域直径，控制滤波强度
        // - sigmaColor=blurKernelSize*2: 色彩相似性，值越大去噪越强
        // - sigmaSpace=blurKernelSize/2: 空间距离权重，控制边缘保护
        cv::bilateralFilter(gamma_corrected, denoised, 
                           blurKernelSize,           // 邻域直径
                           blurKernelSize * 2,       // 色彩空间滤波器的sigma值
                           blurKernelSize / 2);      // 坐标空间滤波器的sigma值
    } else {
        denoised = gamma_corrected.clone();
    }
    
    // === 第4级：边缘锐化 - 恢复细节 ===
    // 问题：前面的处理可能轻微模糊角点边缘
    // 解决方案：拉普拉斯锐化，根据质量要求级别决定是否启用
    // 策略：严格/平衡模式启用，宽松模式跳过（避免噪声放大）
    cv::Mat sharpened;
    if (qualityCheckLevel == STRICT || qualityCheckLevel == BALANCED) {
        // 拉普拉斯锐化核：中心权重5，周围-1，总和=1（保持亮度）
        cv::Mat kernel = (cv::Mat_<float>(3,3) << 
                         0, -1, 0,
                         -1, 5, -1,
                         0, -1, 0);
        cv::filter2D(denoised, sharpened, -1, kernel);
    } else {
        // 宽松模式：跳过锐化，避免在嘈杂环境中放大噪声
        sharpened = denoised.clone();
    }
    
    // === 第5级：最终对比度和亮度微调 ===
    // 问题：需要最后的整体调整以优化角点可见性
    // 解决方案：线性变换 I' = α*I + β
    // 参数：α=1.2(轻微增强对比度), β=10(小幅提升整体亮度)
    cv::Mat final_result;
    sharpened.convertTo(final_result, -1, 1.2, 10); 
    
    // === 第6级：安全处理 - 防止过度增强 ===
    // 问题：多级增强可能导致像素值溢出或分布异常
    // 解决方案：归一化到标准范围，确保输出图像有效
    cv::Mat clamped;
    cv::normalize(final_result, clamped, 0, 255, cv::NORM_MINMAX, CV_8UC3);
    
    // ===============================================================
    // 增强策略总结：
    // 1. 局部对比度增强 → 解决光照不均
    // 2. 伽马校正 → 提升暗部可见性  
    // 3. 双边滤波 → 智能去噪保边缘
    // 4. 边缘锐化 → 恢复角点细节
    // 5. 对比度微调 → 最终优化
    // 6. 安全归一化 → 防止过度处理
    // 
    // 与单纯高斯模糊的区别：
    // - 高斯模糊：只能去噪，会模糊边缘，无法改善亮度/对比度
    // - 本策略：全面解决低光照环境的多重问题，智能保护边缘
    // ===============================================================
    
    return clamped;
}

void CameraCalibrator::filterCalibrationImages() {
    if (imagePoints.empty()) {
        std::cout << "No images to filter" << std::endl;
        return;
    }
    
    std::vector<std::vector<cv::Point2f>> filteredImagePoints;
    std::vector<std::vector<cv::Point3f>> filteredObjectPoints;
    
    std::cout << "Filtering " << imagePoints.size() << " calibration images..." << std::endl;
    std::cout << "objectPoints.size(): " << objectPoints.size() << std::endl;
    std::cout << "Expected corners per image: " << (boardSize.width * boardSize.height) << std::endl;
    
    for (size_t i = 0; i < imagePoints.size(); ++i) {
        std::cout << "Checking image " << i << ":" << std::endl;
        std::cout << "  - imagePoints[" << i << "].size(): " << imagePoints[i].size() << std::endl;
        std::cout << "  - imagePoints[" << i << "].empty(): " << (imagePoints[i].empty() ? "true" : "false") << std::endl;
        std::cout << "  - i < objectPoints.size(): " << (i < objectPoints.size() ? "true" : "false") << std::endl;
        
        if (i < objectPoints.size()) {
            std::cout << "  - objectPoints[" << i << "].size(): " << objectPoints[i].size() << std::endl;
            std::cout << "  - objectPoints[" << i << "].empty(): " << (objectPoints[i].empty() ? "true" : "false") << std::endl;
        }
        
        if (!imagePoints[i].empty() && i < objectPoints.size() && !objectPoints[i].empty()) {
            // 这里我们只能基于角点数量来过滤，因为没有原始图像
            if (imagePoints[i].size() == boardSize.width * boardSize.height) {
                filteredImagePoints.push_back(imagePoints[i]);
                filteredObjectPoints.push_back(objectPoints[i]);
                std::cout << "  ✅ Image " << i << " passed filtering" << std::endl;
            } else {
                std::cout << "  ❌ Filtered out image " << i << " (incorrect corner count: " 
                          << imagePoints[i].size() << " != " << (boardSize.width * boardSize.height) << ")" << std::endl;
            }
        } else {
            std::cout << "  ❌ Filtered out image " << i << " (empty data)" << std::endl;
            if (imagePoints[i].empty()) {
                std::cout << "    - Reason: imagePoints[" << i << "] is empty" << std::endl;
            }
            if (i >= objectPoints.size()) {
                std::cout << "    - Reason: objectPoints index " << i << " >= " << objectPoints.size() << std::endl;
            } else if (objectPoints[i].empty()) {
                std::cout << "    - Reason: objectPoints[" << i << "] is empty" << std::endl;
            }
        }
    }
    
    imagePoints = filteredImagePoints;
    objectPoints = filteredObjectPoints;
    
    std::cout << "Filtered result: " << imagePoints.size() << " valid images remaining" << std::endl;
}
