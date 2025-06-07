// 多语言支持系统
class I18n {
    constructor() {
        this.currentLanguage = 'en'; // 默认英文
        this.translations = {
            zh: {
                // 页面标题
                title: '边缘计算标定测试系统',
                subtitle: '实时视频流采集与坐标转换标定',
                
                // 视频监控
                video_monitoring: '视频流',
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
                save_calibration: '保存标定',
                load_calibration: '加载标定',
                enable_camera_correction: '启用相机校正',
                correction_active: '校正已激活',
                correction_inactive: '校正未激活',
                correction_switching: '状态切换中...',
                correction_enabled: '相机校正已启用',
                correction_disabled: '相机校正已禁用',
                
                // 棋盘格参数
                calibration_parameters: '标定参数设置',
                chessboard_parameters: '棋盘格参数',
                corner_width: '内角点宽度',
                corner_width_hint: '棋盘格内部角点数量（水平方向）',
                corner_height: '内角点高度',
                corner_height_hint: '棋盘格内部角点数量（垂直方向）',
                square_size: '方格大小 (mm)',
                square_size_hint: '实际测量的方格边长，单位毫米',
                set_parameters: '设置参数',
                apply_parameters: '应用参数',
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
                
                // 单应性矩阵标定
                homography_matrix_calibration: '单应性矩阵标定',
                homography_calibration_desc: '通过地面格子交叉点进行图像与地面坐标的转换矩阵标定',
                calibration_operation: '标定操作',
                enter_calibration_mode: '进入标定模式',
                exit_calibration_mode: '退出标定模式',
                compute_homography: '计算单应性矩阵',
                
                // ArUco 测试验证
                aruco_testing_verification: 'ArUco 测试验证',
                aruco_testing_desc: '使用ArUco标记验证单应性矩阵标定结果的准确性',
                enable_aruco_testing: '启用 ArUco 测试',
                show_aruco_guide: '显示使用指南',
                
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
                camera_calibration_mode_active: '相机标定模式',
                switching_camera_calibration_mode: '切换相机标定模式',
                capturing_calibration_image: '正在采集标定图像',
                performing_camera_calibration: '正在执行相机标定',
                saving_calibration_result: '正在保存标定结果',
                setting_chessboard_parameters: '设置棋盘格参数',
                calibration_successful: '标定成功，单应性矩阵已更新',
                current_image_count: '已采集图像数量',
                current_session_images: '当前会话',
                pixels: '像素',
                auto_capture_started: '自动采集已开始',
                auto_capture_failed: '启动自动采集失败',
                auto_capture_stopped: '自动采集已停止',
                auto_capture_completed: '自动采集完成：成功{{success}}张，共尝试{{total}}次',
                starting_auto_capture: '正在启动自动采集，持续{{duration}}秒，间隔{{interval}}毫秒',
                stopping_auto_capture: '正在停止自动采集',
                
                // 高斯模糊相关
                blur_kernel_size: "高斯模糊核",
                blur_kernel_hint: "适用于低光照环境的图像模糊处理",
                blur_none: "无模糊",
                blur_light: "3x3 (轻微)",
                blur_medium: "5x5 (中等)",
                blur_strong: "7x7 (强)",
                blur_extreme: "9x9",
                none: "无",
                
                // 分辨率和性能相关
                display_resolution: "显示分辨率",
                detection_resolution: "检测分辨率",
                performance_mode: "性能模式",
                dual_resolution: "双分辨率",
                single_resolution: "单分辨率",
                
                // 标定流程
                calibration_flow: "流程: 1.设置参数 → 2.进入标定模式 → 3.采集图片 → 4.执行标定 → 5.保存结果",
                auto_capture_image_added: "已采集 {{count}} 张图片",
                
                // 质量检测设置
                quality_check_level: "质量检测级别",
                strict_quality: "严格 (高质量)",
                balanced_quality: "平衡 (推荐)",
                permissive_quality: "宽松 (困难环境)",
                
                // 会话管理
                start_new_session: "开始新会话",
                clear_current_session: "清除当前会话",
                
                // 界面元素
                correction_status: "校正状态",
                processing_delay: "处理延迟",
                show_camera_correction_control: "显示相机校正控制",
                camera_correction_control: "相机校正控制",
                fullscreen_display: "全屏显示",
                unknown: "未知",
                
                // 标定结果显示
                camera_calibration_results: "相机标定结果",
                calibration_success: "标定成功完成",
                calibration_image_count: "标定图像数量",
                calibration_quality: "标定质量",
                save_path: "保存路径",
                camera_matrix: "相机内参矩阵",
                distortion_coefficients: "畸变系数",
                close: "关闭",
                calibration_data_loaded: "相机标定数据已加载",
                calibration_data_load_success: "标定数据加载成功",
                file_path: "文件路径",
                calibration_activated_info: "相机标定已激活，所有视频流和图像处理将自动进行畸变校正",
                
                // 动态状态消息
                switching_camera_calibration_mode: "正在切换相机标定模式...",
                switching_coordinate_calibration_mode: "正在切换坐标标定模式...",
                switching_aruco_testing_mode: "正在切换ArUco测试模式...",
                homography_calibration_mode_enabled: "单应性矩阵标定模式已启用",
                homography_calibration_mode_disabled: "单应性矩阵标定模式已禁用",
                homography_calibration_mode_title: "单应性矩阵标定模式",
                
                // 标定模式提示消息
                calibration_tip_resolution: "画面保持1920×1080分辨率确保计算精度",
                calibration_tip_click_points: "点击视频中的地面格子交叉点进行标定",
                calibration_tip_fullscreen: "按F11进入全屏模式，更精确选点",
                calibration_tip_input_coords: "点击后输入该点的地面坐标（毫米）",
                calibration_tip_select_points: "建议选择画面四角和中心的交叉点",
                calibration_tip_shortcuts: "快捷键：F11切换全屏 | ESC退出全屏",
                
                // 计算和保存相关
                compute_homography_matrix: "计算单应性矩阵",
                homography_computation_success: "单应性矩阵计算成功",
                homography_computation_failed: "单应性矩阵计算失败",
                calibration_success_message: "标定成功！现在可以保存标定结果或进行坐标测试",
                calibration_failed_message: "标定失败：请检查标定点分布",
                
                // 下载相关
                download_camera_calibration: "下载相机内参标定文件",
                download_homography_calibration: "下载单应性矩阵标定文件",
                camera_calibration_downloaded: "已下载相机内参标定文件",
                homography_calibration_downloaded: "已下载单应性矩阵标定文件",
                camera_calibration_download_failed: "下载相机内参标定文件失败",
                homography_calibration_download_failed: "下载单应性矩阵标定文件失败",
                
                // 计算过程相关
                computing_homography_matrix: "正在计算单应性矩阵...",
                minimum_points_required: "至少需要4个标定点才能计算单应性矩阵！",
                
                // 保存和加载相关
                saving_calibration_results: "正在保存标定结果...",
                loading_calibration_results: "正在加载标定结果...",
                calibration_results_saved: "标定结果保存成功",
                calibration_results_loaded: "标定结果加载成功",
                calibration_results_save_failed: "标定结果保存失败",
                calibration_results_load_failed: "标定结果加载失败",
                
                // 标定弹出框相关
                camera_calibration_results_title: "相机标定结果",
                can_save_calibration_results: "现在可以保存标定结果",
                
                // 计算按钮和状态相关
                need_points: "需要{count}个点",
                calculation_results: "计算结果",
                homography_matrix_success: "单应性矩阵计算成功",
                copy_matrix_data: "复制矩阵数据",
                matrix_saved_aruco_test: "矩阵已保存，现在可以进行ArUco测试验证",
                homography_calculation_success_title: "单应性矩阵计算成功！",
                matrix_displayed_in_panel: "矩阵数据已显示在标定面板中",
                switch_to_aruco_test: "或切换到ArUco测试模式验证精度",
                
                // 错误处理相关
                suggested_solutions: "建议解决方案：",
                check_camera_usage: "检查摄像头是否被其他程序占用",
                try_reconnect_camera: "尝试重新连接摄像头设备",
                restart_videomapping: "重启VideoMapping程序",
                check_device_permissions: "检查设备权限设置",
                confirm: "确定",
                fullscreen_failed: "全屏失败",
                fullscreen_permission_error: "无法进入视频全屏模式，请检查浏览器权限",
                
                // 标定详细操作面板
                calibration_detailed_operations: "标定详细操作",
                fullscreen_mode_tip: "全屏模式 - 提高点击选择精度",
                fullscreen: "全屏",
                usage_instructions: "使用说明",
                click_ground_intersections: "点击视频中的地面格子交叉点，然后输入该点的实际地面坐标。至少需要 4 个点。",
                ground_coordinate_x_mm: "地面坐标 X (毫米):",
                ground_coordinate_y_mm: "地面坐标 Y (毫米):",
                remove_last_point: "移除最后一个点",
                clear_all_points: "清除所有点",
                save_matrix_file: "保存矩阵文件",
                load_matrix_file: "加载矩阵文件",
                calibration_points_list: "标定点列表",
                calibration_suggestions: "标定建议",
                maintain_resolution_tip: "保持1920×1080分辨率，确保单应性矩阵计算精度",
                select_intersection_points: "选择地面格子的交叉点作为标定点，位置更准确",
                distribute_points_tip: "标定点应尽量分布在画面的四个角落和中心",
                consistent_coordinate_system: "测量地面坐标时要保持一致的坐标系",
                use_more_points_tip: "建议使用至少6-8个标定点以提高精度",
                click_fullscreen_tip: "点击上方全屏按钮，提高点击选择精度",
                
                // 摄像头状态消息
                camera_recovered: "摄像头已恢复",
                device_working_normally: "设备重新正常工作",
                
                // 计算状态消息
                computing: "计算中...",
                
                // 标定点列表
                no_calibration_points: "暂无标定点",
                image_coord: "图像",
                ground_coord: "地面",
                
                // ArUco测试相关
                disable_aruco_testing: "禁用 ArUco 测试",
                enable_aruco_testing: "启用 ArUco 测试",
                test_mode_running: "测试模式运行中",
                calibrated: "已标定",
                not_calibrated: "未标定",
                waiting_detection: "等待检测",
                aruco_test_enabled_matrix_loaded: "ArUco测试模式已启用，单应性矩阵已加载",
                aruco_test_enabled_no_matrix: "ArUco测试模式已启用，但未检测到单应性矩阵",
                aruco_test_disabled: "ArUco测试模式已禁用",
                detected_markers: "检测到 {count} 个标记",
                searching_markers: "搜索标记中...",
                marker_coordinates_set_success: "标记坐标设置成功",
                marker_coordinates_set_failed: "标记坐标设置失败",
                marker_coordinates_saved_success: "标记坐标保存成功",
                marker_coordinates_saved_failed: "标记坐标保存失败",
                marker_coordinates_loaded_success: "标记坐标加载成功",
                marker_coordinates_loaded_failed: "标记坐标加载失败",
                
                // ArUco面板和状态显示
                detection_status: "检测状态",
                detected_markers_label: "检测到的标记：",
                matrix_status_label: "矩阵状态：",
                aruco_test_detailed_operations: "ArUco 测试详细操作",
                place_aruco_markers_tip: "在画面中放置ArUco标记，验证单应性矩阵准确性",
                detection_results: "检测结果",
                no_aruco_markers_detected: "暂未检测到ArUco标记",
                quick_settings: "快速设置",
                detection_sensitivity: "检测灵敏度:",
                sensitivity_low: "低",
                sensitivity_medium: "中",
                sensitivity_high: "高",
                apply_settings: "应用设置",
                
                // 坐标转换测试面板
                coordinate_conversion_test: "坐标转换测试",
                click_video_convert_coordinates: "点击视频将图像坐标转换为地面坐标。",
                image_x: "图像 X:",
                image_y: "图像 Y:",
                ground_x: "地面 X:",
                ground_y: "地面 Y:",
                
                // ArUco标记检测结果显示
                marker_id: "标记 ID",
                coordinates_calculated: "已计算坐标",
                no_matrix: "无矩阵",
                image_center: "图像中心",
                ground_coordinates: "地面坐标",
                detection_quality: "检测质量",
                quality_good: "良好",
                
                // 坐标输入提示
                input_ground_x_prompt: "请输入地面坐标 X (毫米):",
                input_ground_y_prompt: "请输入地面坐标 Y (毫米):",
                observe_detection_results: "观察检测结果和计算出的地面坐标",
                
                // ArUco测试指南
                ensure_homography_calibration_completed: "确保已完成单应性矩阵标定或加载了矩阵文件",
                place_aruco_markers_known_positions: "将ArUco标记放置在地面的已知位置",
                enable_aruco_test_mode: "启用ArUco测试模式",
                compare_calculated_coordinates: "比较计算坐标与实际位置来验证精度"
            },
            en: {
                // 页面标题
                title: 'Edge Computing Calibration Test System',
                subtitle: 'Real-time Video Stream Capture and Coordinate Transformation Calibration',
                
                // 视频监控
                video_monitoring: 'Video Stream',
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
                load_calibration: 'Load Calibration',
                enable_camera_correction: 'Enable Camera Correction',
                correction_active: 'Correction Active',
                correction_inactive: 'Correction Inactive',
                correction_switching: 'Switching Status...',
                correction_enabled: 'Camera correction enabled',
                correction_disabled: 'Camera correction disabled',
                
                // 棋盘格参数
                calibration_parameters: 'Calibration Parameters',
                chessboard_parameters: 'Chessboard Parameters',
                corner_width: 'Corner Width',
                corner_width_hint: 'Number of inner corners in horizontal direction',
                corner_height: 'Corner Height',
                corner_height_hint: 'Number of inner corners in vertical direction',
                square_size: 'Square Size (mm)',
                square_size_hint: 'Actual measured square edge length in millimeters',
                set_parameters: 'Set Parameters',
                apply_parameters: 'Apply Parameters',
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
                
                // 单应性矩阵标定
                homography_matrix_calibration: 'Homography Matrix Calibration',
                homography_calibration_desc: 'Calibrate the transformation matrix between image coordinates and actual ground coordinates using ground grid intersection points',
                calibration_operation: 'Calibration Operations',
                enter_calibration_mode: 'Enter Calibration Mode',
                exit_calibration_mode: 'Exit Calibration Mode',
                compute_homography: 'Compute Homography Matrix',
                
                // ArUco 测试验证
                aruco_testing_verification: 'ArUco Testing Verification',
                aruco_testing_desc: 'Verify the accuracy of the homography matrix calibration using ArUco markers',
                enable_aruco_testing: 'Enable ArUco Testing',
                show_aruco_guide: 'Show Usage Guide',
                
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
                camera_calibration_mode_active: 'Camera Calibration Mode',
                switching_camera_calibration_mode: 'Switching Camera Calibration Mode',
                capturing_calibration_image: 'Capturing Calibration Image',
                performing_camera_calibration: 'Performing Camera Calibration',
                saving_calibration_result: 'Saving Calibration Result',
                setting_chessboard_parameters: 'Setting Chessboard Parameters',
                calibration_successful: 'Calibration successful, homography matrix updated',
                current_image_count: 'Current image count',
                current_session_images: 'Current Session Images',
                pixels: 'pixels',
                auto_capture_started: 'Auto capture started',
                auto_capture_failed: 'Failed to start auto capture',
                auto_capture_stopped: 'Auto capture stopped',
                auto_capture_completed: 'Auto capture completed: {{success}} successful out of {{total}} attempts',
                starting_auto_capture: 'Starting auto capture for {{duration}}s with {{interval}}ms interval',
                stopping_auto_capture: 'Stopping auto capture',
                
                // 高斯模糊相关
                blur_kernel_size: "Gaussian Blur Kernel",
                blur_kernel_hint: "Image blur processing for low-light environments",
                blur_none: "No Blur",
                blur_light: "3x3 (Light)",
                blur_medium: "5x5 (Medium)",
                blur_strong: "7x7 (Strong)",
                blur_extreme: "9x9",
                none: "None",
                
                // 分辨率和性能相关
                display_resolution: "Display Resolution",
                detection_resolution: "Detection Resolution",
                performance_mode: "Performance Mode",
                dual_resolution: "Dual Resolution",
                single_resolution: "Single Resolution",
                
                // 标定流程
                calibration_flow: "Flow: 1.Set Parameters → 2.Enter Calibration Mode → 3.Capture Images → 4.Perform Calibration → 5.Save Results",
                auto_capture_image_added: "Captured {{count}} images",
                
                // 质量检测设置
                quality_check_level: "Quality Check Level",
                strict_quality: "Strict (High Quality)",
                balanced_quality: "Balanced (Recommended)",
                permissive_quality: "Permissive (Difficult Environment)",
                
                // 会话管理
                start_new_session: "Start New Session",
                clear_current_session: "Clear Current Session",
                
                // 界面元素
                correction_status: "Correction Status",
                processing_delay: "Processing Delay",
                show_camera_correction_control: "Show Camera Correction Control",
                camera_correction_control: "Camera Correction Control",
                fullscreen_display: "Fullscreen Display",
                unknown: "Unknown",
                
                // 标定结果显示
                camera_calibration_results: "Camera Calibration Results",
                calibration_success: "Calibration Completed Successfully",
                calibration_image_count: "Calibration Image Count",
                calibration_quality: "Calibration Quality",
                save_path: "Save Path",
                camera_matrix: "Camera Matrix",
                distortion_coefficients: "Distortion Coefficients",
                close: "Close",
                calibration_data_loaded: "Camera Calibration Data Loaded",
                calibration_data_load_success: "Calibration Data Loaded Successfully",
                file_path: "File Path",
                calibration_activated_info: "Camera calibration is activated. All video streams and image processing will automatically apply distortion correction.",
                
                // 动态状态消息
                switching_camera_calibration_mode: "Switching camera calibration mode...",
                switching_coordinate_calibration_mode: "Switching coordinate calibration mode...",
                switching_aruco_testing_mode: "Switching ArUco testing mode...",
                homography_calibration_mode_enabled: "Homography matrix calibration mode enabled",
                homography_calibration_mode_disabled: "Homography matrix calibration mode disabled",
                homography_calibration_mode_title: "Homography Matrix Calibration Mode",
                
                // 标定模式提示消息
                calibration_tip_resolution: "Maintain 1920×1080 resolution for calculation accuracy",
                calibration_tip_click_points: "Click on ground grid intersection points in the video for calibration",
                calibration_tip_fullscreen: "Press F11 to enter fullscreen mode for more precise point selection",
                calibration_tip_input_coords: "Enter the ground coordinates (in millimeters) after clicking",
                calibration_tip_select_points: "Recommend selecting intersection points at corners and center of the frame",
                calibration_tip_shortcuts: "Shortcuts: F11 toggle fullscreen | ESC exit fullscreen",
                
                // 计算和保存相关
                compute_homography_matrix: "Compute Homography Matrix",
                homography_computation_success: "Homography matrix computation successful",
                homography_computation_failed: "Homography matrix computation failed",
                calibration_success_message: "Calibration successful! You can now save the calibration results or perform coordinate testing",
                calibration_failed_message: "Calibration failed: Please check the distribution of calibration points",
                
                // 下载相关
                download_camera_calibration: "Download Camera Calibration File",
                download_homography_calibration: "Download Homography Matrix File",
                camera_calibration_downloaded: "Camera calibration file downloaded",
                homography_calibration_downloaded: "Homography matrix file downloaded",
                camera_calibration_download_failed: "Failed to download camera calibration file",
                homography_calibration_download_failed: "Failed to download homography matrix file",
                
                // 计算过程相关
                computing_homography_matrix: "Computing homography matrix...",
                minimum_points_required: "At least 4 calibration points are required to compute the homography matrix!",
                
                // 保存和加载相关
                saving_calibration_results: "Saving calibration results...",
                loading_calibration_results: "Loading calibration results...",
                calibration_results_saved: "Calibration results saved successfully",
                calibration_results_loaded: "Calibration results loaded successfully",
                calibration_results_save_failed: "Failed to save calibration results",
                calibration_results_load_failed: "Failed to load calibration results",
                
                // 标定弹出框相关
                camera_calibration_results_title: "Camera Calibration Results",
                can_save_calibration_results: "You can now save the calibration results",
                
                // 计算按钮和状态相关
                need_points: "Need {count} points",
                calculation_results: "Calculation Results",
                homography_matrix_success: "Homography matrix calculation successful",
                copy_matrix_data: "Copy Matrix Data",
                matrix_saved_aruco_test: "Matrix saved, you can now perform ArUco testing for verification",
                homography_calculation_success_title: "Homography Matrix Calculation Successful!",
                matrix_displayed_in_panel: "Matrix data is displayed in the calibration panel",
                switch_to_aruco_test: "Or switch to ArUco test mode to verify accuracy",
                
                // 错误处理相关
                suggested_solutions: "Suggested Solutions:",
                check_camera_usage: "Check if the camera is being used by other programs",
                try_reconnect_camera: "Try reconnecting the camera device",
                restart_videomapping: "Restart VideoMapping program",
                check_device_permissions: "Check device permission settings",
                confirm: "Confirm",
                fullscreen_failed: "Fullscreen Failed",
                fullscreen_permission_error: "Unable to enter video fullscreen mode, please check browser permissions",
                
                // 标定详细操作面板
                calibration_detailed_operations: "Detailed Calibration Operations",
                fullscreen_mode_tip: "Fullscreen Mode - Improve Click Selection Accuracy",
                fullscreen: "Fullscreen",
                usage_instructions: "Usage Instructions",
                click_ground_intersections: "Click on ground grid intersection points in the video, then enter the actual ground coordinates of that point. At least 4 points are required.",
                ground_coordinate_x_mm: "Ground Coordinate X (mm):",
                ground_coordinate_y_mm: "Ground Coordinate Y (mm):",
                remove_last_point: "Remove Last Point",
                clear_all_points: "Clear All Points",
                save_matrix_file: "Save Matrix File",
                load_matrix_file: "Load Matrix File",
                calibration_points_list: "Calibration Points List",
                calibration_suggestions: "Calibration Suggestions",
                maintain_resolution_tip: "Maintain 1920×1080 resolution to ensure homography matrix calculation accuracy",
                select_intersection_points: "Select ground grid intersection points as calibration points for more accurate positioning",
                distribute_points_tip: "Calibration points should be distributed as much as possible in the four corners and center of the frame",
                consistent_coordinate_system: "Maintain a consistent coordinate system when measuring ground coordinates",
                use_more_points_tip: "Recommend using at least 6-8 calibration points to improve accuracy",
                click_fullscreen_tip: "Click the fullscreen button above to improve click selection accuracy",
                
                // 摄像头状态消息
                camera_recovered: "Camera Recovered",
                device_working_normally: "Device is working normally again",
                
                // 计算状态消息
                computing: "Computing...",
                
                // 标定点列表
                no_calibration_points: "No calibration points",
                image_coord: "Image",
                ground_coord: "Ground",
                
                // ArUco测试相关
                disable_aruco_testing: "Disable ArUco Testing",
                enable_aruco_testing: "Enable ArUco Testing",
                test_mode_running: "Test mode running",
                calibrated: "Calibrated",
                not_calibrated: "Not calibrated",
                waiting_detection: "Waiting for detection",
                aruco_test_enabled_matrix_loaded: "ArUco test mode enabled, homography matrix loaded",
                aruco_test_enabled_no_matrix: "ArUco test mode enabled, but no homography matrix detected",
                aruco_test_disabled: "ArUco test mode disabled",
                detected_markers: "Detected {count} markers",
                searching_markers: "Searching for markers...",
                marker_coordinates_set_success: "Marker coordinates set successfully",
                marker_coordinates_set_failed: "Failed to set marker coordinates",
                marker_coordinates_saved_success: "Marker coordinates saved successfully",
                marker_coordinates_saved_failed: "Failed to save marker coordinates",
                marker_coordinates_loaded_success: "Marker coordinates loaded successfully",
                marker_coordinates_loaded_failed: "Failed to load marker coordinates",
                
                // ArUco面板和状态显示
                detection_status: "Detection Status",
                detected_markers_label: "Detected Markers:",
                matrix_status_label: "Matrix Status:",
                aruco_test_detailed_operations: "ArUco Test Detailed Operations",
                place_aruco_markers_tip: "Place ArUco markers in the scene to verify homography matrix accuracy",
                detection_results: "Detection Results",
                no_aruco_markers_detected: "No ArUco markers detected",
                quick_settings: "Quick Settings",
                detection_sensitivity: "Detection Sensitivity:",
                sensitivity_low: "Low",
                sensitivity_medium: "Medium",
                sensitivity_high: "High",
                apply_settings: "Apply Settings",
                
                // 坐标转换测试面板
                coordinate_conversion_test: "Coordinate Conversion Test",
                click_video_convert_coordinates: "Click on the video to convert image coordinates to ground coordinates.",
                image_x: "Image X:",
                image_y: "Image Y:",
                ground_x: "Ground X:",
                ground_y: "Ground Y:",
                
                // ArUco标记检测结果显示
                marker_id: "Marker ID",
                coordinates_calculated: "Coordinates Calculated",
                no_matrix: "No Matrix",
                image_center: "Image Center",
                ground_coordinates: "Ground Coordinates",
                detection_quality: "Detection Quality",
                quality_good: "Good",
                
                // 坐标输入提示
                input_ground_x_prompt: "Please enter ground coordinate X (mm):",
                input_ground_y_prompt: "Please enter ground coordinate Y (mm):",
                observe_detection_results: "Observe detection results and calculated ground coordinates",
                
                // ArUco测试指南
                ensure_homography_calibration_completed: "Ensure homography matrix calibration is completed or matrix file is loaded",
                place_aruco_markers_known_positions: "Place ArUco markers at known positions on the ground",
                enable_aruco_test_mode: "Enable ArUco test mode",
                compare_calculated_coordinates: "Compare calculated coordinates with actual positions to verify accuracy"
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
                if (element.tagName.toLowerCase() === 'title') {
                    element.textContent = translation;
                    document.title = translation;
                } else {
                    element.textContent = translation;
                }
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
        
        // 处理title属性
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            const translation = this.translations[this.currentLanguage][key];
            if (translation) {
                element.setAttribute('title', translation);
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