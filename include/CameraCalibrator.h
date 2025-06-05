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
    
    // 图像保存控制
    void setSaveCalibrationImages(bool save) { saveCalibrationImages = save; }
    bool getSaveCalibrationImages() const { return saveCalibrationImages; }
    
    // 高斯模糊核设置
    void setBlurKernelSize(int size) { blurKernelSize = size; }
    int getBlurKernelSize() const { return blurKernelSize; }
    
    // 质量检测严格程度设置
    enum QualityCheckLevel {
        STRICT,      // 严格模式 - 高质量但可能拒绝较多图片
        BALANCED,    // 平衡模式 - 默认，平衡质量和数量
        PERMISSIVE   // 宽松模式 - 接受更多图片，适合困难环境
    };
    
    void setQualityCheckLevel(QualityCheckLevel level) { qualityCheckLevel = level; }
    QualityCheckLevel getQualityCheckLevel() const { return qualityCheckLevel; }
    
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
    size_t getImageCount() const;
    
    // 新增：会话管理方法
    void clearCurrentSession();              // 清除当前会话的所有数据
    size_t getCurrentSessionImageCount() const; // 获取当前会话的图像数量
    void startNewCalibrationSession();       // 开始新的标定会话
    
    // 获取棋盘格参数
    cv::Size getBoardSize() const { return boardSize; }
    float getSquareSize() const { return squareSize; }
    
    // 公共棋盘格检测方法，供前端和后端共用
    bool detectChessboard(const cv::Mat& image, std::vector<cv::Point2f>& corners, bool isForCalibration = false);
    
    // 图片质量评估和预处理
    struct ImageQualityMetrics {
        double sharpness;           // 清晰度分数 (0-100)
        double brightness;          // 亮度分数 (0-255)
        double contrast;            // 对比度分数 (0-100)
        double cornerConfidence;    // 角点检测置信度 (0-1)
        double boardCoverage;       // 棋盘格覆盖率 (0-1)
        double skewAngle;           // 倾斜角度 (度)
        bool isValid;               // 整体质量是否合格
        std::string qualityLevel;   // "excellent", "good", "poor"
    };
    
    ImageQualityMetrics evaluateImageQuality(const cv::Mat& image, const std::vector<cv::Point2f>& corners);
    bool shouldAcceptImage(const ImageQualityMetrics& metrics);
    cv::Mat preprocessImage(const cv::Mat& image);  // 图像预处理
    void filterCalibrationImages();  // 过滤已有图片

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
    void initializeExistingImageCount();  // 初始化已有图片数量

    // 图像保存控制
    bool saveCalibrationImages;
    int nextImageNumber;     // 下一个图片的编号
    
    // 高斯模糊核大小
    int blurKernelSize;      // 0=无模糊, 3,5,7,9等

    // 质量检测严格程度设置
    QualityCheckLevel qualityCheckLevel;
};

#endif // CAMERA_CALIBRATOR_H
