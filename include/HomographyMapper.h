#ifndef HOMOGRAPHY_MAPPER_H
#define HOMOGRAPHY_MAPPER_H

#include <opencv2/opencv.hpp>
#include <opencv2/aruco.hpp>
#include <vector>
#include <string>
#include <fstream>
#include <iostream>
#include <map>

class HomographyMapper {
public:
    HomographyMapper();
    ~HomographyMapper();

    // 标定点相关方法
    void addCalibrationPoint(const cv::Point2f& imagePoint, const cv::Point2f& groundPoint);
    void clearCalibrationPoints();
    bool computeHomography();
    cv::Point2f imageToGround(const cv::Point2f& imagePoint) const;
    cv::Point2f groundToImage(const cv::Point2f& groundPoint) const;
    bool saveHomography(const std::string& filename) const;
    bool loadHomography(const std::string& filename);
    const std::vector<std::pair<cv::Point2f, cv::Point2f>>& getCalibrationPoints() const;
    bool isCalibrated() const;
    void setCalibrated(bool calibrated);
    cv::Mat getHomographyMatrix() const;
    void setHomographyMatrix(const cv::Mat& matrix);
    cv::Mat getInverseHomographyMatrix() const;
    
    // ArUco 标记相关方法
    bool detectArUcoMarkers(const cv::Mat& frame, std::vector<int>& markerIds, 
                           std::vector<std::vector<cv::Point2f>>& markerCorners);
    void drawDetectedMarkers(cv::Mat& frame, const std::vector<int>& markerIds, 
                           const std::vector<std::vector<cv::Point2f>>& markerCorners);
    bool calibrateFromArUcoMarkers(const cv::Mat& frame, const std::map<int, cv::Point2f>& markerGroundCoordinates);
    void setMarkerGroundCoordinates(int markerId, const cv::Point2f& groundCoord);
    std::map<int, cv::Point2f> getMarkerGroundCoordinates() const;
    bool saveMarkerGroundCoordinates(const std::string& filename) const;
    bool loadMarkerGroundCoordinates(const std::string& filename);
    
    // 坐标系设置和转换相关方法
    void setOrigin(const cv::Point2f& imagePoint);
    cv::Point2f getOrigin() const;
    void setCoordinateType(const std::string& type); // "cartesian" 或 "polar"
    std::string getCoordinateType() const;
    cv::Point2f convertToPolar(const cv::Point2f& cartesianPoint) const;
    cv::Point2f convertToCartesian(const cv::Point2f& polarPoint) const;
    cv::Point2f imageToGroundWithOrigin(const cv::Point2f& imagePoint) const;
    cv::Point2f groundToImageWithOrigin(const cv::Point2f& groundPoint) const;
    
    // 绘制网格线和坐标系
    void drawGridLines(cv::Mat& frame, int gridSize = 50, int numLines = 10) const;
    void drawCoordinateSystem(cv::Mat& frame) const;

private:
    // 标定相关成员变量
    std::vector<std::pair<cv::Point2f, cv::Point2f>> calibrationPoints_; // 图像点和地面点对
    cv::Mat homographyMatrix_;      // 单应性矩阵（从图像到地面）
    cv::Mat inverseHomographyMatrix_; // 逆单应性矩阵（从地面到图像）
    
    // ArUco 标记相关成员变量
    cv::Ptr<cv::aruco::Dictionary> markerDictionary_; // ArUco 标记字典
    cv::Ptr<cv::aruco::DetectorParameters> detectorParams_; // 检测参数
    std::map<int, cv::Point2f> markerGroundCoordinates_; // 标记ID到地面坐标的映射
    bool calibrated_;              // 是否已标定
    
    // 坐标系设置相关成员变量
    cv::Point2f origin_;           // 原点在地面坐标系中的位置
    cv::Point2f imageOrigin_;      // 原点在图像坐标系中的位置
    std::string coordinateType_;   // 坐标类型："cartesian" 或 "polar"
};

#endif // HOMOGRAPHY_MAPPER_H
