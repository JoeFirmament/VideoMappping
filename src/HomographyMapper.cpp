#include "../include/HomographyMapper.h"

HomographyMapper::HomographyMapper() : calibrated_(false) {
    // 初始化单应性矩阵为空
    homographyMatrix_ = cv::Mat();
    inverseHomographyMatrix_ = cv::Mat();
    
    // 初始化 ArUco 标记检测器
    markerDictionary_ = cv::aruco::getPredefinedDictionary(cv::aruco::DICT_4X4_50);
    detectorParams_ = cv::aruco::DetectorParameters::create();
    
    // 设置检测参数 - 针对远距离检测优化
    detectorParams_->cornerRefinementMethod = cv::aruco::CORNER_REFINE_SUBPIX;
    
    // 优化自适应阈值参数，提高远距离小标记的检测能力
    detectorParams_->adaptiveThreshWinSizeMin = 3;      // 最小窗口保持较小
    detectorParams_->adaptiveThreshWinSizeMax = 35;     // 增大最大窗口，从23提高到35
    detectorParams_->adaptiveThreshWinSizeStep = 5;     // 减小步长，从10改为5，更精细
    detectorParams_->adaptiveThreshConstant = 5;        // 减小常数，从7改为5，降低阈值
    
    // 添加更多检测参数优化
    detectorParams_->minMarkerPerimeterRate = 0.01;     // 降低最小周长比例，从默认0.03降到0.01
    detectorParams_->maxMarkerPerimeterRate = 8.0;      // 增加最大周长比例，从默认4.0增到8.0
    detectorParams_->polygonalApproxAccuracyRate = 0.05; // 提高多边形近似精度
    detectorParams_->minCornerDistanceRate = 0.05;      // 减小最小角点距离比例
    detectorParams_->minDistanceToBorder = 1;           // 减小到边界的最小距离
    detectorParams_->markerBorderBits = 1;              // 标记边界位数
    detectorParams_->minOtsuStdDev = 5.0;               // 降低Otsu标准差阈值
    
    // 初始化坐标系相关参数
    origin_ = cv::Point2f(0.0f, 0.0f);
    imageOrigin_ = cv::Point2f(0.0f, 0.0f);
    coordinateType_ = "cartesian"; // 默认使用直角坐标系
}

HomographyMapper::~HomographyMapper() {
    // 清理资源
}

void HomographyMapper::addCalibrationPoint(const cv::Point2f& imagePoint, const cv::Point2f& groundPoint) {
    // 添加一对标定点
    calibrationPoints_.push_back(std::make_pair(imagePoint, groundPoint));
    
    // 添加新点后，标定状态需要重置
    calibrated_ = false;
}

void HomographyMapper::clearCalibrationPoints() {
    calibrationPoints_.clear();
    calibrated_ = false;
}

bool HomographyMapper::computeHomography() {
    // 至少需要4对点来计算单应性矩阵
    if (calibrationPoints_.size() < 4) {
        std::cerr << "Error: At least 4 point pairs are required for homography calculation." << std::endl;
        return false;
    }
    
    // 准备源点和目标点向量
    std::vector<cv::Point2f> srcPoints;
    std::vector<cv::Point2f> dstPoints;
    
    for (const auto& pair : calibrationPoints_) {
        srcPoints.push_back(pair.first);  // 图像点
        dstPoints.push_back(pair.second); // 地面点
    }
    
    // 计算单应性矩阵（从图像到地面的映射）
    homographyMatrix_ = cv::findHomography(srcPoints, dstPoints, cv::RANSAC);
    
    // 计算逆单应性矩阵（从地面到图像的映射）
    inverseHomographyMatrix_ = cv::findHomography(dstPoints, srcPoints, cv::RANSAC);
    
    // 检查矩阵是否有效
    if (homographyMatrix_.empty() || inverseHomographyMatrix_.empty()) {
        std::cerr << "Error: Failed to compute homography matrix." << std::endl;
        return false;
    }
    
    calibrated_ = true;
    return true;
}

cv::Point2f HomographyMapper::imageToGround(const cv::Point2f& imagePoint) const {
    if (!calibrated_) {
        std::cerr << "Warning: Homography not calibrated. Returning input point." << std::endl;
        return imagePoint;
    }
    
    // 创建输入点的向量
    std::vector<cv::Point2f> srcPoints = {imagePoint};
    std::vector<cv::Point2f> dstPoints;
    
    // 应用透视变换
    cv::perspectiveTransform(srcPoints, dstPoints, homographyMatrix_);
    
    return dstPoints[0];
}

cv::Point2f HomographyMapper::groundToImage(const cv::Point2f& groundPoint) const {
    if (!calibrated_) {
        std::cerr << "Warning: Homography not calibrated. Returning input point." << std::endl;
        return groundPoint;
    }
    
    // 创建输入点的向量
    std::vector<cv::Point2f> srcPoints = {groundPoint};
    std::vector<cv::Point2f> dstPoints;
    
    // 应用透视变换
    cv::perspectiveTransform(srcPoints, dstPoints, inverseHomographyMatrix_);
    
    return dstPoints[0];
}

bool HomographyMapper::saveHomography(const std::string& filename) const {
    if (!calibrated_) {
        std::cerr << "Error: Cannot save uncalibrated homography." << std::endl;
        return false;
    }
    
    try {
        cv::FileStorage fs(filename, cv::FileStorage::WRITE);
        if (!fs.isOpened()) {
            std::cerr << "Error: Could not open file " << filename << " for writing." << std::endl;
            return false;
        }
        
        // 保存单应性矩阵
        fs << "homography_matrix" << homographyMatrix_;
        
        // 保存标定点
        fs << "num_points" << (int)calibrationPoints_.size();
        
        for (size_t i = 0; i < calibrationPoints_.size(); i++) {
            std::string pointName = "point_" + std::to_string(i);
            fs << pointName + "_image_x" << calibrationPoints_[i].first.x;
            fs << pointName + "_image_y" << calibrationPoints_[i].first.y;
            fs << pointName + "_ground_x" << calibrationPoints_[i].second.x;
            fs << pointName + "_ground_y" << calibrationPoints_[i].second.y;
        }
        
        fs.release();
        std::cout << "Homography saved to " << filename << std::endl;
        return true;
    }
    catch (const cv::Exception& e) {
        std::cerr << "Error: OpenCV exception while saving homography: " << e.what() << std::endl;
        return false;
    }
    catch (const std::exception& e) {
        std::cerr << "Error: Exception while saving homography: " << e.what() << std::endl;
        return false;
    }
}

bool HomographyMapper::loadHomography(const std::string& filename) {
    try {
        cv::FileStorage fs(filename, cv::FileStorage::READ);
        if (!fs.isOpened()) {
            std::cerr << "Error: Could not open file " << filename << " for reading." << std::endl;
            return false;
        }
        
        // 加载单应性矩阵
        fs["homography_matrix"] >> homographyMatrix_;
        
        // 计算逆矩阵
        inverseHomographyMatrix_ = homographyMatrix_.inv();
        
        // 加载标定点
        int numPoints;
        fs["num_points"] >> numPoints;
        
        calibrationPoints_.clear();
        
        for (int i = 0; i < numPoints; i++) {
            std::string pointName = "point_" + std::to_string(i);
            float imgX, imgY, gndX, gndY;
            
            fs[pointName + "_image_x"] >> imgX;
            fs[pointName + "_image_y"] >> imgY;
            fs[pointName + "_ground_x"] >> gndX;
            fs[pointName + "_ground_y"] >> gndY;
            
            calibrationPoints_.push_back(std::make_pair(
                cv::Point2f(imgX, imgY),
                cv::Point2f(gndX, gndY)
            ));
        }
        
        fs.release();
        
        // 检查矩阵是否有效
        if (homographyMatrix_.empty()) {
            std::cerr << "Error: Invalid homography matrix in file." << std::endl;
            return false;
        }
        
        calibrated_ = true;
        std::cout << "Homography loaded from " << filename << std::endl;
        return true;
    }
    catch (const cv::Exception& e) {
        std::cerr << "Error: OpenCV exception while loading homography: " << e.what() << std::endl;
        return false;
    }
    catch (const std::exception& e) {
        std::cerr << "Error: Exception while loading homography: " << e.what() << std::endl;
        return false;
    }
}

const std::vector<std::pair<cv::Point2f, cv::Point2f>>& HomographyMapper::getCalibrationPoints() const {
    return calibrationPoints_;
}

bool HomographyMapper::isCalibrated() const {
    return calibrated_;
}

void HomographyMapper::setCalibrated(bool calibrated) {
    calibrated_ = calibrated;
}

cv::Mat HomographyMapper::getHomographyMatrix() const {
    return homographyMatrix_;
}

void HomographyMapper::setHomographyMatrix(const cv::Mat& matrix) {
    homographyMatrix_ = matrix.clone();
    // 同时更新逆矩阵
    if (!matrix.empty()) {
        inverseHomographyMatrix_ = matrix.inv();
    }
}

cv::Mat HomographyMapper::getInverseHomographyMatrix() const {
    return inverseHomographyMatrix_;
}

// ArUco 标记检测方法
bool HomographyMapper::detectArUcoMarkers(const cv::Mat& frame, std::vector<int>& markerIds, 
                                        std::vector<std::vector<cv::Point2f>>& markerCorners) {
    try {
        // 清空之前的结果
        markerIds.clear();
        markerCorners.clear();
        
        // 检测 ArUco 标记
        cv::aruco::detectMarkers(frame, markerDictionary_, markerCorners, markerIds, detectorParams_);
        
        if (markerIds.size() > 0) {
            // 简洁的调试信息
            std::cout << "[ArUco] 检测到 " << markerIds.size() << " 个标记 - IDs: ";
            for (size_t i = 0; i < markerIds.size(); i++) {
                std::cout << markerIds[i];
                if (i < markerIds.size() - 1) std::cout << ", ";
            }
            std::cout << std::endl;
            
            return true;
        } else {
            // 只在调试模式下显示未检测到的信息
            static int noDetectionCounter = 0;
            noDetectionCounter++;
            if (noDetectionCounter % 30 == 0) { // 每30帧显示一次，避免日志刷屏
                std::cout << "[ArUco] 未检测到标记 (已尝试 " << noDetectionCounter << " 帧)" << std::endl;
            }
        }
        return false;
    } catch (const cv::Exception& e) {
        std::cerr << "[ArUco ERROR] 检测异常: " << e.what() << std::endl;
        return false;
    }
}

void HomographyMapper::drawDetectedMarkers(cv::Mat& frame, const std::vector<int>& markerIds, 
                                        const std::vector<std::vector<cv::Point2f>>& markerCorners) {
    if (markerIds.size() > 0) {
        // 绘制检测到的标记边框和角点
        for (size_t i = 0; i < markerIds.size(); i++) {
            int id = markerIds[i];
            const std::vector<cv::Point2f>& corners = markerCorners[i];
            
            // 绘制标记边框（绿色）
            for (int j = 0; j < 4; j++) {
                cv::line(frame, corners[j], corners[(j + 1) % 4], cv::Scalar(0, 255, 0), 2);
            }
            
            // 绘制角点（红色，更大更明显）
            for (int j = 0; j < 4; j++) {
                const auto& corner = corners[j];
                if (j == 0) {
                    // 第一个角点（左上角）是ArUco的原点，用特殊标记
                    cv::circle(frame, corner, 10, cv::Scalar(0, 0, 255), -1);  // 更大的红色实心圆
                    cv::circle(frame, corner, 12, cv::Scalar(255, 255, 255), 3); // 白色外圈
                    cv::putText(frame, "O", cv::Point(corner.x + 15, corner.y - 5), 
                               cv::FONT_HERSHEY_SIMPLEX, 0.8, cv::Scalar(0, 0, 255), 2);
                } else {
                    // 其他角点
                    cv::circle(frame, corner, 6, cv::Scalar(0, 0, 255), -1);  // 红色实心圆
                    cv::circle(frame, corner, 8, cv::Scalar(255, 255, 255), 2); // 白色外圈
                    cv::putText(frame, std::to_string(j), cv::Point(corner.x + 10, corner.y - 5), 
                               cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(255, 255, 255), 2);
                }
            }
            
            // 计算标记中心
            cv::Point2f center(0, 0);
            for (const auto& corner : corners) {
                center += corner;
            }
            center *= 0.25f;
            
            // 绘制中心点（蓝色）
            cv::circle(frame, center, 4, cv::Scalar(255, 0, 0), -1);
            
            // 在中心点旁边添加说明文字
            cv::putText(frame, "Center", cv::Point(center.x + 20, center.y + 5), 
                       cv::FONT_HERSHEY_SIMPLEX, 0.5, cv::Scalar(255, 0, 0), 1);
            
            // 绘制ID（绿色，更大字体）
            std::string idText = "ID:" + std::to_string(id);
            cv::putText(frame, idText, 
                       cv::Point(center.x + 15, center.y - 10), 
                       cv::FONT_HERSHEY_SIMPLEX, 1.2, cv::Scalar(0, 255, 0), 3);
            
            // 如果该标记有对应的地面坐标，显示地面坐标（蓝色）
            auto it = markerGroundCoordinates_.find(id);
            if (it != markerGroundCoordinates_.end()) {
                std::string coordText = "Set:(" + std::to_string(int(it->second.x)) + "," + 
                                      std::to_string(int(it->second.y)) + ")";
                cv::putText(frame, coordText, 
                           cv::Point(center.x + 15, center.y + 15), 
                           cv::FONT_HERSHEY_SIMPLEX, 0.8, cv::Scalar(255, 0, 0), 2);
            }
                
            // 如果已标定，显示图像到地面的映射（黄色，放大字体）
            if (calibrated_) {
                cv::Point2f groundPoint = imageToGround(center);
                std::string mappedText = "Pos:(" + std::to_string(int(groundPoint.x)) + "," + 
                                      std::to_string(int(groundPoint.y)) + ")";
                cv::putText(frame, mappedText, 
                           cv::Point(center.x + 15, center.y + 40), 
                           cv::FONT_HERSHEY_SIMPLEX, 1.0, cv::Scalar(0, 255, 255), 3);
                
                // 添加调试信息
                std::cout << "[ArUco Position] Marker " << id << " Ground coord: (" 
                         << groundPoint.x << "," << groundPoint.y << ")" << std::endl;
            } else {
                // 显示未标定状态
                cv::putText(frame, "No Matrix", 
                           cv::Point(center.x + 15, center.y + 40), 
                           cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 0, 255), 2);
            }
        }
        
        // 清理左上角显示，使用简洁的英文信息
        std::string statsText = "ArUco: " + std::to_string(markerIds.size()) + " markers";
        cv::putText(frame, statsText, cv::Point(10, 30), 
                   cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 255, 0), 2);
        
        // 显示标定状态（简化）
        std::string calibrationStatus = calibrated_ ? "Matrix: OK" : "Matrix: NO";
        cv::Scalar statusColor = calibrated_ ? cv::Scalar(0, 255, 0) : cv::Scalar(0, 0, 255);
        cv::putText(frame, calibrationStatus, cv::Point(10, 60), 
                   cv::FONT_HERSHEY_SIMPLEX, 0.7, statusColor, 2);
    }
}

bool HomographyMapper::calibrateFromArUcoMarkers(const cv::Mat& frame, 
                                               const std::map<int, cv::Point2f>& markerGroundCoordinates) {
    std::cout << "[ArUco 标定] 开始从ArUco标记进行标定..." << std::endl;
    std::cout << "[ArUco 标定] 已设置地面坐标的标记数量: " << markerGroundCoordinates.size() << std::endl;
    
    // 检测标记
    std::vector<int> markerIds;
    std::vector<std::vector<cv::Point2f>> markerCorners;
    
    if (!detectArUcoMarkers(frame, markerIds, markerCorners)) {
        std::cerr << "[ArUco 标定] 错误: 当前帧中未检测到ArUco标记" << std::endl;
        return false;
    }
    
    // 清除现有标定点
    clearCalibrationPoints();
    
    // 统计可用于标定的标记数量
    int usableMarkers = 0;
    
    // 使用标记中心点和地面坐标添加标定点对
    for (size_t i = 0; i < markerIds.size(); i++) {
        int id = markerIds[i];
        auto it = markerGroundCoordinates.find(id);
        
        if (it != markerGroundCoordinates.end()) {
            // 计算标记中心
            cv::Point2f center(0, 0);
            for (const auto& corner : markerCorners[i]) {
                center += corner;
            }
            center *= 0.25f;
            
            // 添加标定点对
            addCalibrationPoint(center, it->second);
            usableMarkers++;
            
            std::cout << "[ArUco 标定] 标记 " << id << ": 图像坐标(" 
                     << center.x << "," << center.y << ") -> 地面坐标(" 
                     << it->second.x << "," << it->second.y << ")" << std::endl;
        } else {
            std::cout << "[ArUco 标定] 警告: 标记 " << id << " 未设置地面坐标，跳过" << std::endl;
        }
    }
    
    if (usableMarkers < 4) {
        std::cerr << "[ArUco 标定] 错误: 可用标记数量不足 (" << usableMarkers 
                  << "/4)，需要至少4个已设置地面坐标的标记" << std::endl;
        return false;
    }
    
    std::cout << "[ArUco 标定] 使用 " << usableMarkers << " 个标记进行标定..." << std::endl;
    
    // 计算单应性矩阵
    bool success = computeHomography();
    
    if (success) {
        std::cout << "[ArUco 标定] ✅ 标定成功！单应性矩阵已计算完成" << std::endl;
    } else {
        std::cerr << "[ArUco 标定] ❌ 标定失败！请检查标记分布和坐标设置" << std::endl;
    }
    
    return success;
}

void HomographyMapper::setMarkerGroundCoordinates(int markerId, const cv::Point2f& groundCoord) {
    markerGroundCoordinates_[markerId] = groundCoord;
}

std::map<int, cv::Point2f> HomographyMapper::getMarkerGroundCoordinates() const {
    return markerGroundCoordinates_;
}

bool HomographyMapper::saveMarkerGroundCoordinates(const std::string& filename) const {
    try {
        cv::FileStorage fs(filename, cv::FileStorage::WRITE);
        if (!fs.isOpened()) {
            std::cerr << "Error: Could not open file " << filename << " for writing." << std::endl;
            return false;
        }
        
        fs << "MarkerCount" << (int)markerGroundCoordinates_.size();
        int idx = 0;
        
        for (const auto& marker : markerGroundCoordinates_) {
            std::string nodeName = "Marker_" + std::to_string(idx);
            fs << nodeName << "{"; 
            fs << "ID" << marker.first;
            fs << "GroundX" << marker.second.x;
            fs << "GroundY" << marker.second.y;
            fs << "}";
            idx++;
        }
        
        fs.release();
        return true;
    } catch (const cv::Exception& e) {
        std::cerr << "Error saving marker ground coordinates: " << e.what() << std::endl;
        return false;
    }
}

bool HomographyMapper::loadMarkerGroundCoordinates(const std::string& filename) {
    try {
        cv::FileStorage fs(filename, cv::FileStorage::READ);
        if (!fs.isOpened()) {
            std::cerr << "Error: Could not open file " << filename << " for reading." << std::endl;
            return false;
        }
        
        // 清除现有数据
        markerGroundCoordinates_.clear();
        
        int markerCount;
        fs["MarkerCount"] >> markerCount;
        
        for (int i = 0; i < markerCount; i++) {
            std::string nodeName = "Marker_" + std::to_string(i);
            cv::FileNode markerNode = fs[nodeName];
            
            int id;
            float groundX, groundY;
            
            markerNode["ID"] >> id;
            markerNode["GroundX"] >> groundX;
            markerNode["GroundY"] >> groundY;
            
            markerGroundCoordinates_[id] = cv::Point2f(groundX, groundY);
        }
        
        fs.release();
        return true;
    } catch (const cv::Exception& e) {
        std::cerr << "Error loading marker ground coordinates: " << e.what() << std::endl;
        return false;
    }
}

void HomographyMapper::drawGridLines(cv::Mat& frame, int gridSize, int numLines) const {
    if (!calibrated_ || frame.empty()) {
        return;
    }
    
    // 获取图像尺寸
    int width = frame.cols;
    int height = frame.rows;
    
    // 绘制水平线
    for (int i = -numLines / 2; i <= numLines / 2; ++i) {
        // 水平线的两个端点在地面坐标系中的位置
        cv::Point2f groundStart(-numLines / 2 * gridSize, i * gridSize);
        cv::Point2f groundEnd(numLines / 2 * gridSize, i * gridSize);
        
        // 转换到图像坐标系
        cv::Point2f imageStart = groundToImage(groundStart);
        cv::Point2f imageEnd = groundToImage(groundEnd);
        
        // 绘制水平线
        cv::line(frame, imageStart, imageEnd, cv::Scalar(0, 255, 0), 1, cv::LINE_AA);
    }
    
    // 绘制垂直线
    for (int i = -numLines / 2; i <= numLines / 2; ++i) {
        // 垂直线的两个端点在地面坐标系中的位置
        cv::Point2f groundStart(i * gridSize, -numLines / 2 * gridSize);
        cv::Point2f groundEnd(i * gridSize, numLines / 2 * gridSize);
        
        // 转换到图像坐标系
        cv::Point2f imageStart = groundToImage(groundStart);
        cv::Point2f imageEnd = groundToImage(groundEnd);
        
        // 绘制垂直线
        cv::line(frame, imageStart, imageEnd, cv::Scalar(0, 255, 0), 1, cv::LINE_AA);
    }
}

// 坐标系设置和转换相关方法实现
void HomographyMapper::setOrigin(const cv::Point2f& imagePoint) {
    if (!calibrated_) {
        std::cerr << "Error: Cannot set origin before calibration." << std::endl;
        return;
    }
    
    // 保存图像坐标系中的原点位置
    imageOrigin_ = imagePoint;
    
    // 计算地面坐标系中的原点位置
    origin_ = imageToGround(imagePoint);
    
    std::cout << "Origin set to image point: (" << imagePoint.x << ", " << imagePoint.y
              << "), ground point: (" << origin_.x << ", " << origin_.y << ")" << std::endl;
}

cv::Point2f HomographyMapper::getOrigin() const {
    return origin_;
}

void HomographyMapper::setCoordinateType(const std::string& type) {
    if (type == "cartesian" || type == "polar") {
        coordinateType_ = type;
        std::cout << "Coordinate type set to: " << type << std::endl;
    } else {
        std::cerr << "Error: Invalid coordinate type. Use 'cartesian' or 'polar'." << std::endl;
    }
}

std::string HomographyMapper::getCoordinateType() const {
    return coordinateType_;
}

cv::Point2f HomographyMapper::convertToPolar(const cv::Point2f& cartesianPoint) const {
    // 计算相对于原点的坐标
    float x = cartesianPoint.x - origin_.x;
    float y = cartesianPoint.y - origin_.y;
    
    // 计算极坐标 (r, theta)
    float r = std::sqrt(x*x + y*y);
    float theta = std::atan2(y, x) * 180.0f / CV_PI; // 转换为角度
    
    // 确保角度在 [0, 360) 范围内
    if (theta < 0) {
        theta += 360.0f;
    }
    
    return cv::Point2f(r, theta);
}

cv::Point2f HomographyMapper::convertToCartesian(const cv::Point2f& polarPoint) const {
    // 从极坐标 (r, theta) 转换为直角坐标
    float r = polarPoint.x;
    float theta = polarPoint.y * CV_PI / 180.0f; // 转换为弧度
    
    float x = r * std::cos(theta) + origin_.x;
    float y = r * std::sin(theta) + origin_.y;
    
    return cv::Point2f(x, y);
}

cv::Point2f HomographyMapper::imageToGroundWithOrigin(const cv::Point2f& imagePoint) const {
    if (!calibrated_) {
        return cv::Point2f(0, 0);
    }
    
    // 先转换为地面坐标
    cv::Point2f groundPoint = imageToGround(imagePoint);
    
    // 计算相对于原点的坐标
    cv::Point2f relativePoint(groundPoint.x - origin_.x, groundPoint.y - origin_.y);
    
    // 根据坐标类型返回结果
    if (coordinateType_ == "polar") {
        return convertToPolar(groundPoint);
    } else {
        return relativePoint; // 返回相对于原点的直角坐标
    }
}

cv::Point2f HomographyMapper::groundToImageWithOrigin(const cv::Point2f& groundPoint) const {
    if (!calibrated_) {
        return cv::Point2f(0, 0);
    }
    
    cv::Point2f absoluteGroundPoint;
    
    // 根据坐标类型处理输入
    if (coordinateType_ == "polar") {
        absoluteGroundPoint = convertToCartesian(groundPoint);
    } else {
        // 从相对坐标转换为绝对坐标
        absoluteGroundPoint = cv::Point2f(groundPoint.x + origin_.x, groundPoint.y + origin_.y);
    }
    
    // 转换为图像坐标
    return groundToImage(absoluteGroundPoint);
}

void HomographyMapper::drawCoordinateSystem(cv::Mat& frame) const {
    if (!calibrated_ || frame.empty()) {
        return;
    }
    
    // 获取图像尺寸
    int width = frame.cols;
    int height = frame.rows;
    
    // 检查原点是否在画面内
    bool originInFrame = (imageOrigin_.x >= 0 && imageOrigin_.x < width && 
                          imageOrigin_.y >= 0 && imageOrigin_.y < height);
    
    // 绘制坐标轴，即使原点在画面外
    int axisLength = 600; // 进一步增加坐标轴长度，从400提高到600像素
    int axisThickness = 2; // 恢复原来的粗细2像素
    
    // X轴（红色）
    cv::Point2f xAxisEnd;
    if (coordinateType_ == "cartesian") {
        // 地面坐标系中的X轴终点
        cv::Point2f groundXAxisEnd(origin_.x + axisLength, origin_.y);
        xAxisEnd = groundToImage(groundXAxisEnd);
    } else {
        // 极坐标系中的径向轴
        cv::Point2f groundXAxisEnd = convertToCartesian(cv::Point2f(axisLength, 0));
        xAxisEnd = groundToImage(groundXAxisEnd);
    }
    
    // Y轴（蓝色，从绿色改为蓝色使其更显眼）
    cv::Point2f yAxisEnd;
    if (coordinateType_ == "cartesian") {
        // 地面坐标系中的Y轴终点
        cv::Point2f groundYAxisEnd(origin_.x, origin_.y + axisLength);
        yAxisEnd = groundToImage(groundYAxisEnd);
    } else {
        // 极坐标系中的角度轴（90度方向）
        cv::Point2f groundYAxisEnd = convertToCartesian(cv::Point2f(axisLength, 90));
        yAxisEnd = groundToImage(groundYAxisEnd);
    }
    
    // 如果原点在画面内，绘制完整的坐标轴
    if (originInFrame) {
        // 原点用更大的圆标记
        cv::circle(frame, imageOrigin_, 8, cv::Scalar(0, 0, 255), -1);
        // X轴（红色，更粗）
        cv::line(frame, imageOrigin_, xAxisEnd, cv::Scalar(0, 0, 255), axisThickness);
        // Y轴（蓝色，更粗）
        cv::line(frame, imageOrigin_, yAxisEnd, cv::Scalar(255, 0, 0), axisThickness);
        
        // 添加坐标轴标签
        cv::putText(frame, "X", cv::Point(xAxisEnd.x + 10, xAxisEnd.y), 
                   cv::FONT_HERSHEY_SIMPLEX, 1.0, cv::Scalar(0, 0, 255), 2);
        cv::putText(frame, "Y", cv::Point(yAxisEnd.x, yAxisEnd.y - 10), 
                   cv::FONT_HERSHEY_SIMPLEX, 1.0, cv::Scalar(255, 0, 0), 2);
    } else {
        // 原点在画面外，绘制坐标轴的可见部分
        // 计算与画面边界的交点
        cv::Point2f xAxisStart = imageOrigin_;
        cv::Point2f yAxisStart = imageOrigin_;
        
        // 如果原点在画面下方（最常见的情况）
        if (imageOrigin_.y >= height) {
            // 计算X轴与画面底部的交点
            float t = (height - 1 - imageOrigin_.y) / (xAxisEnd.y - imageOrigin_.y);
            if (t >= 0 && t <= 1) {
                xAxisStart.x = imageOrigin_.x + t * (xAxisEnd.x - imageOrigin_.x);
                xAxisStart.y = height - 1;
            }
            
            // 计算Y轴与画面底部的交点
            t = (height - 1 - imageOrigin_.y) / (yAxisEnd.y - imageOrigin_.y);
            if (t >= 0 && t <= 1) {
                yAxisStart.x = imageOrigin_.x + t * (yAxisEnd.x - imageOrigin_.x);
                yAxisStart.y = height - 1;
            }
        }
        
        // 绘制可见的坐标轴部分
        if (xAxisStart.y < height && xAxisEnd.y >= 0 && xAxisEnd.y < height && 
            xAxisEnd.x >= 0 && xAxisEnd.x < width) {
            cv::line(frame, xAxisStart, xAxisEnd, cv::Scalar(0, 0, 255), axisThickness);
        }
        
        if (yAxisStart.y < height && yAxisEnd.y >= 0 && yAxisEnd.y < height && 
            yAxisEnd.x >= 0 && yAxisEnd.x < width) {
            cv::line(frame, yAxisStart, yAxisEnd, cv::Scalar(255, 0, 0), axisThickness);
        }
    }
    
    // 绘制坐标系类型文本
    std::string coordTypeText = coordinateType_ == "cartesian" ? "Cartesian" : "Polar";
    cv::putText(frame, coordTypeText, cv::Point(10, 30), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 0, 255), 2);
    
    // 绘制原点坐标文本
    std::stringstream originText;
    originText << "Origin: (" << std::fixed << std::setprecision(1) << origin_.x << ", " << origin_.y << ")";
    cv::putText(frame, originText.str(), cv::Point(10, 60), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 0, 255), 2);
    
    // 添加原点位置提示（如果在画面外）
    if (!originInFrame) {
        std::string locationText;
        if (imageOrigin_.y >= height) {
            locationText = "Origin below frame";
        } else if (imageOrigin_.y < 0) {
            locationText = "Origin above frame";
        } else if (imageOrigin_.x < 0) {
            locationText = "Origin left of frame";
        } else {
            locationText = "Origin right of frame";
        }
        cv::putText(frame, locationText, cv::Point(10, 90), cv::FONT_HERSHEY_SIMPLEX, 0.7, cv::Scalar(0, 0, 255), 2);
    }
}

// ArUco 检测参数设置方法实现
void HomographyMapper::setDetectionParameters(int adaptiveThreshWinSizeMin, int adaptiveThreshWinSizeMax, 
                                             int adaptiveThreshWinSizeStep, double adaptiveThreshConstant) {
    if (detectorParams_) {
        detectorParams_->adaptiveThreshWinSizeMin = adaptiveThreshWinSizeMin;
        detectorParams_->adaptiveThreshWinSizeMax = adaptiveThreshWinSizeMax;
        detectorParams_->adaptiveThreshWinSizeStep = adaptiveThreshWinSizeStep;
        detectorParams_->adaptiveThreshConstant = adaptiveThreshConstant;
        
        std::cout << "[ArUco 参数] 检测参数已更新:" << std::endl;
        std::cout << "  - 自适应阈值窗口最小值: " << adaptiveThreshWinSizeMin << std::endl;
        std::cout << "  - 自适应阈值窗口最大值: " << adaptiveThreshWinSizeMax << std::endl;
        std::cout << "  - 自适应阈值窗口步长: " << adaptiveThreshWinSizeStep << std::endl;
        std::cout << "  - 自适应阈值常数: " << adaptiveThreshConstant << std::endl;
    }
}

void HomographyMapper::setCornerRefinementMethod(int method) {
    if (detectorParams_) {
        detectorParams_->cornerRefinementMethod = method;
        
        std::string methodName;
        switch (method) {
            case cv::aruco::CORNER_REFINE_NONE:
                methodName = "无角点优化";
                break;
            case cv::aruco::CORNER_REFINE_SUBPIX:
                methodName = "亚像素角点优化";
                break;
            case cv::aruco::CORNER_REFINE_CONTOUR:
                methodName = "轮廓角点优化";
                break;
            default:
                methodName = "未知方法";
                break;
        }
        
        std::cout << "[ArUco 参数] 角点优化方法已设置为: " << methodName << std::endl;
    }
}

void HomographyMapper::getDetectionParameters(int& adaptiveThreshWinSizeMin, int& adaptiveThreshWinSizeMax, 
                                             int& adaptiveThreshWinSizeStep, double& adaptiveThreshConstant) const {
    if (detectorParams_) {
        adaptiveThreshWinSizeMin = detectorParams_->adaptiveThreshWinSizeMin;
        adaptiveThreshWinSizeMax = detectorParams_->adaptiveThreshWinSizeMax;
        adaptiveThreshWinSizeStep = detectorParams_->adaptiveThreshWinSizeStep;
        adaptiveThreshConstant = detectorParams_->adaptiveThreshConstant;
    }
}

int HomographyMapper::getCornerRefinementMethod() const {
    if (detectorParams_) {
        return detectorParams_->cornerRefinementMethod;
    }
    return cv::aruco::CORNER_REFINE_NONE;
}



