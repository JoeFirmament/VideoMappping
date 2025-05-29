#include "../include/HomographyMapper.h"

HomographyMapper::HomographyMapper() : calibrated_(false) {
    // 初始化单应性矩阵为空
    homographyMatrix_ = cv::Mat();
    inverseHomographyMatrix_ = cv::Mat();
    
    // 初始化 ArUco 标记检测器
    markerDictionary_ = cv::aruco::getPredefinedDictionary(cv::aruco::DICT_4X4_50);
    detectorParams_ = cv::aruco::DetectorParameters::create();
    
    // 设置检测参数
    detectorParams_->cornerRefinementMethod = cv::aruco::CORNER_REFINE_SUBPIX;
    detectorParams_->adaptiveThreshWinSizeMin = 3;
    detectorParams_->adaptiveThreshWinSizeMax = 23;
    detectorParams_->adaptiveThreshWinSizeStep = 10;
    detectorParams_->adaptiveThreshConstant = 7;
    
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
        // 检测 ArUco 标记
        cv::aruco::detectMarkers(frame, markerDictionary_, markerCorners, markerIds, detectorParams_);
        
        // 如果检测到标记，进行角点细化
        if (markerIds.size() > 0) {
            // 简化调用，不使用细化函数，因为它需要一个棋盘对象
            // cv::aruco::refineDetectedMarkers 需要一个 Board 对象，而我们这里只是单独的标记
            return true;
        }
        return false;
    } catch (const cv::Exception& e) {
        std::cerr << "Error detecting ArUco markers: " << e.what() << std::endl;
        return false;
    }
}

void HomographyMapper::drawDetectedMarkers(cv::Mat& frame, const std::vector<int>& markerIds, 
                                        const std::vector<std::vector<cv::Point2f>>& markerCorners) {
    if (markerIds.size() > 0) {
        // 绘制检测到的标记
        cv::aruco::drawDetectedMarkers(frame, markerCorners, markerIds);
        
        // 绘制标记ID和地面坐标（如果有）
        for (size_t i = 0; i < markerIds.size(); i++) {
            int id = markerIds[i];
            cv::Point2f center(0, 0);
            
            // 计算标记中心
            for (const auto& corner : markerCorners[i]) {
                center += corner;
            }
            center *= 0.25f;
            
            // 绘制ID
            cv::putText(frame, "ID:" + std::to_string(id), 
                       cv::Point(center.x + 10, center.y), 
                       cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(0, 255, 0), 2);
            
            // 如果该标记有对应的地面坐标，显示地面坐标
            auto it = markerGroundCoordinates_.find(id);
            if (it != markerGroundCoordinates_.end()) {
                std::string coordText = "(" + std::to_string(int(it->second.x)) + "," + 
                                      std::to_string(int(it->second.y)) + ")";
                cv::putText(frame, coordText, 
                           cv::Point(center.x + 10, center.y + 25), 
                           cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(255, 0, 0), 2);
                
                // 如果已标定，显示图像到地面的映射
                if (calibrated_) {
                    cv::Point2f groundPoint = imageToGround(center);
                    std::string mappedText = "-> (" + std::to_string(int(groundPoint.x)) + "," + 
                                          std::to_string(int(groundPoint.y)) + ")";
                    cv::putText(frame, mappedText, 
                               cv::Point(center.x + 10, center.y + 50), 
                               cv::FONT_HERSHEY_SIMPLEX, 0.6, cv::Scalar(0, 0, 255), 2);
                }
            }
        }
    }
}

bool HomographyMapper::calibrateFromArUcoMarkers(const cv::Mat& frame, 
                                               const std::map<int, cv::Point2f>& markerGroundCoordinates) {
    // 检测标记
    std::vector<int> markerIds;
    std::vector<std::vector<cv::Point2f>> markerCorners;
    
    if (!detectArUcoMarkers(frame, markerIds, markerCorners)) {
        std::cerr << "No ArUco markers detected for calibration." << std::endl;
        return false;
    }
    
    // 清除现有标定点
    clearCalibrationPoints();
    
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
        }
    }
    
    // 计算单应性矩阵
    return computeHomography();
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
    
    // 如果原点在画面内，绘制原点
    if (originInFrame) {
        cv::circle(frame, imageOrigin_, 5, cv::Scalar(0, 0, 255), -1);
    }
    
    // 绘制坐标轴，即使原点在画面外
    int axisLength = 200; // 增加坐标轴长度，以确保可见
    
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
    
    // Y轴（绿色）
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
        cv::line(frame, imageOrigin_, xAxisEnd, cv::Scalar(0, 0, 255), 2);
        cv::line(frame, imageOrigin_, yAxisEnd, cv::Scalar(0, 255, 0), 2);
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
            cv::line(frame, xAxisStart, xAxisEnd, cv::Scalar(0, 0, 255), 2);
        }
        
        if (yAxisStart.y < height && yAxisEnd.y >= 0 && yAxisEnd.y < height && 
            yAxisEnd.x >= 0 && yAxisEnd.x < width) {
            cv::line(frame, yAxisStart, yAxisEnd, cv::Scalar(0, 255, 0), 2);
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
