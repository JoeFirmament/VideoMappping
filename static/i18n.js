// 多语言支持系统
class I18n {
    constructor() {
        this.currentLanguage = 'zh'; // 默认中文
        this.translations = {
            zh: {
                // 页面标题
                title: '边缘计算标定测试系统',
                subtitle: '实时视频流采集与坐标转换标定',
                
                // 视频监控
                video_monitoring: '视频监控',
                status_connecting: '状态: 正在连接服务器...',
                video_stream: '视频流',
                
                // 统计信息
                fps: 'FPS',
                resolution: '分辨率',
                latency: '帧间隔',
                
                // 控制按钮
                start: '开始',
                stop: '停止',
                fullscreen: '全屏',
                
                // 摄像头设置
                camera_settings: '摄像头设置',
                resolution_select: '分辨率选择',
                
                // 相机标定
                camera_intrinsic_calibration: '相机内参标定',
                camera_calibration_desc: '用于消除镜头畸变，提高测量精度',
                camera_calibration_mode: '相机标定模式',
                capture_image: '采集标定图像',
                manual_capture_image: '手动采集标定图像',
                capture_image_hint: '点击按钮从当前视频帧采集标定图像',
                perform_calibration: '执行标定',
                save_calibration: '保存标定结果',
                
                // 棋盘格参数
                chessboard_parameters: '棋盘格参数',
                corner_width: '内角点宽度',
                corner_width_hint: '棋盘格内部角点数量（水平方向）',
                corner_height: '内角点高度',
                corner_height_hint: '棋盘格内部角点数量（垂直方向）',
                square_size: '方格大小 (mm)',
                square_size_hint: '实际测量的方格边长，单位毫米',
                set_parameters: '设置参数',
                reprojection_error: '重投影误差',
                saved_images_count: '已保存标定图片',
                
                // 自动采集相关
                auto_capture_settings: '自动采集设置',
                auto_capture_time: '自动采集时间(秒)',
                auto_capture_interval: '采集间隔(毫秒)',
                start_auto_capture: '开始自动采集',
                stop_auto_capture: '停止自动采集',
                
                // 倒计时相关
                remaining_time: '剩余时间',
                next_capture_in: '下次采集',
                capture_progress: '采集进度',
                
                // 坐标变换标定
                coordinate_transform_calibration: '坐标变换标定',
                coordinate_calibration_desc: '用于图像坐标与实际地面坐标的转换',
                enter_calibration_mode: '进入标定模式',
                exit_calibration_mode: '退出标定模式',
                compute_homography: '计算单应性矩阵',
                
                // ArUco标记
                aruco_marker_detection: 'ArUco 标记检测',
                enable_aruco_mode: '启用 ArUco 模式',
                calibrate_from_aruco: '从 ArUco 标记标定',
                save_marker_coords: '保存标记坐标',
                load_marker_coords: '加载标记坐标',
                
                // 坐标系设置
                coordinate_system: '坐标系设置',
                set_origin: '设置原点',
                toggle_coord_type: '切换坐标类型',
                coord_type: '坐标类型',
                origin_position: '原点位置',
                
                // 调试信息
                debug_information: '调试信息',
                show_debug_info: '显示调试信息',
                homography_matrix: '单应性矩阵',
                export_matrix: '导出矩阵',
                detected_markers: '检测到的标记',
                last_operation: '最近操作',
                
                // 状态消息
                connected: '已连接',
                disconnected: '连接断开',
                connecting: '正在连接',
                websocket_error: 'WebSocket连接错误',
                operation_successful: '操作成功',
                operation_failed: '操作失败',
                websocket_not_connected: 'WebSocket未连接',
                
                // 相机标定相关
                exit_calibration_mode: '退出标定模式',
                camera_calibration_mode_active: '相机标定模式',
                switching_camera_calibration_mode: '切换相机标定模式',
                capturing_calibration_image: '正在采集标定图像',
                performing_camera_calibration: '正在执行相机标定',
                saving_calibration_result: '正在保存标定结果',
                setting_chessboard_parameters: '设置棋盘格参数',
                calibration_successful: '标定成功，单应性矩阵已更新',
                current_image_count: '已采集图像数量',
                pixels: '像素',
                auto_capture_started: '自动采集已开始，持续{{duration}}秒，间隔{{interval}}毫秒',
                auto_capture_failed: '启动自动采集失败',
                auto_capture_stopped: '自动采集已停止',
                auto_capture_completed: '自动采集完成：成功{{success}}张，共尝试{{total}}次',
                starting_auto_capture: '正在启动自动采集，持续{{duration}}秒，间隔{{interval}}毫秒',
                stopping_auto_capture: '正在停止自动采集',
                
                // 新增翻译键
                manual_capture_image: "手动采集标定图像",
                auto_capture_settings: "自动采集设置",
                remaining_time: "剩余时间",
                next_capture_in: "下次采集",
                capture_progress: "采集进度",
                
                // 高斯模糊相关
                blur_kernel_size: "高斯模糊核",
                blur_kernel_hint: "适用于低光照环境的图像模糊处理",
                blur_none: "无模糊",
                blur_light: "3x3 (轻微)",
                blur_medium: "5x5 (中等)",
                blur_strong: "7x7 (强)",
                blur_extreme: "9x9 (极强)",
                
                // 分辨率和性能相关
                display_resolution: "显示分辨率",
                detection_resolution: "检测分辨率",
                performance_mode: "性能模式",
                dual_resolution: "双分辨率",
                single_resolution: "单分辨率"
            },
            en: {
                // 页面标题
                title: 'Edge Computing Calibration Test System',
                subtitle: 'Real-time Video Stream Capture and Coordinate Transformation Calibration',
                
                // 视频监控
                video_monitoring: 'Video Monitoring',
                status_connecting: 'Status: Connecting to server...',
                video_stream: 'Video Stream',
                
                // 统计信息
                fps: 'FPS',
                resolution: 'Resolution',
                latency: 'Frame Interval',
                
                // 控制按钮
                start: 'Start',
                stop: 'Stop',
                fullscreen: 'Fullscreen',
                
                // 摄像头设置
                camera_settings: 'Camera Settings',
                resolution_select: 'Resolution Selection',
                
                // 相机标定
                camera_intrinsic_calibration: 'Camera Intrinsic Calibration',
                camera_calibration_desc: 'Used to eliminate lens distortion and improve measurement accuracy',
                camera_calibration_mode: 'Camera Calibration Mode',
                capture_image: 'Capture Image',
                manual_capture_image: 'Manual Capture Image',
                capture_image_hint: 'Click the button to capture a calibration image from the current video frame',
                perform_calibration: 'Perform Calibration',
                save_calibration: 'Save Calibration',
                
                // 棋盘格参数
                chessboard_parameters: 'Chessboard Parameters',
                corner_width: 'Corner Width',
                corner_width_hint: 'Number of inner corners in horizontal direction',
                corner_height: 'Corner Height',
                corner_height_hint: 'Number of inner corners in vertical direction',
                square_size: 'Square Size (mm)',
                square_size_hint: 'Actual measured square edge length in millimeters',
                set_parameters: 'Set Parameters',
                reprojection_error: 'Reprojection Error',
                saved_images_count: 'Saved Calibration Images',
                
                // 自动采集相关
                auto_capture_settings: 'Auto Capture Settings',
                auto_capture_time: 'Auto Capture Time (sec)',
                auto_capture_interval: 'Capture Interval (ms)',
                start_auto_capture: 'Start Auto Capture',
                stop_auto_capture: 'Stop Auto Capture',
                
                // 倒计时相关
                remaining_time: 'Remaining Time',
                next_capture_in: 'Next Capture In',
                capture_progress: 'Capture Progress',
                
                // 坐标变换标定
                coordinate_transform_calibration: 'Coordinate Transform Calibration',
                coordinate_calibration_desc: 'Used for conversion between image coordinates and actual ground coordinates',
                enter_calibration_mode: 'Enter Calibration Mode',
                exit_calibration_mode: 'Exit Calibration Mode',
                compute_homography: 'Compute Homography Matrix',
                
                // ArUco标记
                aruco_marker_detection: 'ArUco Marker Detection',
                enable_aruco_mode: 'Enable ArUco Mode',
                calibrate_from_aruco: 'Calibrate from ArUco',
                save_marker_coords: 'Save Marker Coords',
                load_marker_coords: 'Load Marker Coords',
                
                // 坐标系设置
                coordinate_system: 'Coordinate System',
                set_origin: 'Set Origin',
                toggle_coord_type: 'Toggle Coord Type',
                coord_type: 'Coordinate Type',
                origin_position: 'Origin Position',
                
                // 调试信息
                debug_information: 'Debug Information',
                show_debug_info: 'Show Debug Info',
                homography_matrix: 'Homography Matrix',
                export_matrix: 'Export Matrix',
                detected_markers: 'Detected Markers',
                last_operation: 'Last Operation',
                
                // 状态消息
                connected: 'Connected',
                disconnected: 'Disconnected',
                connecting: 'Connecting',
                websocket_error: 'WebSocket Connection Error',
                operation_successful: 'Operation Successful',
                operation_failed: 'Operation Failed',
                websocket_not_connected: 'WebSocket Not Connected',
                
                // 相机标定相关
                exit_calibration_mode: 'Exit Calibration Mode',
                camera_calibration_mode_active: 'Camera Calibration Mode',
                switching_camera_calibration_mode: 'Switching Camera Calibration Mode',
                capturing_calibration_image: 'Capturing Calibration Image',
                performing_camera_calibration: 'Performing Camera Calibration',
                saving_calibration_result: 'Saving Calibration Result',
                setting_chessboard_parameters: 'Setting Chessboard Parameters',
                calibration_successful: 'Calibration successful, homography matrix updated',
                current_image_count: 'Current image count',
                pixels: 'pixels',
                auto_capture_started: 'Auto capture started for {{duration}}s with {{interval}}ms interval',
                auto_capture_failed: 'Failed to start auto capture',
                auto_capture_stopped: 'Auto capture stopped',
                auto_capture_completed: 'Auto capture completed: {{success}} successful out of {{total}} attempts',
                starting_auto_capture: 'Starting auto capture for {{duration}}s with {{interval}}ms interval',
                stopping_auto_capture: 'Stopping auto capture',
                
                // 新增翻译键
                manual_capture_image: "Manual capture calibration image",
                auto_capture_settings: "Auto capture settings",
                remaining_time: "Remaining time",
                next_capture_in: "Next capture in",
                capture_progress: "Capture progress",
                
                // 高斯模糊相关
                blur_kernel_size: "Gaussian Blur Kernel",
                blur_kernel_hint: "Image blur processing for low-light environments",
                blur_none: "No Blur",
                blur_light: "3x3 (Light)",
                blur_medium: "5x5 (Medium)",
                blur_strong: "7x7 (Strong)",
                blur_extreme: "9x9 (Extreme)",
                
                // 分辨率和性能相关
                display_resolution: "Display Resolution",
                detection_resolution: "Detection Resolution",
                performance_mode: "Performance Mode",
                dual_resolution: "Dual Resolution",
                single_resolution: "Single Resolution"
            }
        };
        
        this.init();
    }
    
    init() {
        // 从localStorage读取保存的语言设置
        const savedLanguage = localStorage.getItem('language');
        if (savedLanguage && this.translations[savedLanguage]) {
            this.currentLanguage = savedLanguage;
        }
        
        // 设置语言选择器
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.value = this.currentLanguage;
            languageSelect.addEventListener('change', (e) => {
                this.setLanguage(e.target.value);
            });
        }
        
        // 应用当前语言
        this.applyLanguage();
    }
    
    setLanguage(language) {
        if (this.translations[language]) {
            this.currentLanguage = language;
            localStorage.setItem('language', language);
            this.applyLanguage();
        }
    }
    
    applyLanguage() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translations[this.currentLanguage][key];
            if (translation) {
                element.textContent = translation;
            }
        });
        
        // 处理alt属性
        const altElements = document.querySelectorAll('[data-i18n-alt]');
        altElements.forEach(element => {
            const key = element.getAttribute('data-i18n-alt');
            const translation = this.translations[this.currentLanguage][key];
            if (translation) {
                element.setAttribute('alt', translation);
            }
        });
    }
    
    // 获取翻译文本
    t(key) {
        return this.translations[this.currentLanguage][key] || key;
    }
    
    // 获取当前语言
    getCurrentLanguage() {
        return this.currentLanguage;
    }
}

// 创建全局实例
window.i18n = new I18n(); 