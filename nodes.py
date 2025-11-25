# -*- coding: utf-8 -*-
"""
hosepen节点定义
"""

class HosepenNode:
    """hosepen占位节点"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
        }
    
    RETURN_TYPES = ()
    FUNCTION = "execute"
    CATEGORY = "hosepen"
    
    def execute(self):
        return ()


class HosepenImageInput:
    """hosepen图像输入节点 - 用于从其他节点导入图像到画板"""
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
            },
        }
    
    RETURN_TYPES = ()
    FUNCTION = "receive_image"
    CATEGORY = "hosepen"
    OUTPUT_NODE = True
    
    def receive_image(self, images):
        """接收图像，不输出，供前端画板读取"""
        # 返回空元组，因为没有输出
        return {}


class HosepenImageOutput:
    """hosepen图像输出节点 - 用于从画板导出图像到其他节点"""
    
    @classmethod
    def INPUT_TYPES(cls):
        import folder_paths
        input_dir = folder_paths.get_input_directory()
        files = []
        # 只列出 hosepen 子文件夹中的文件
        import os
        hosepen_dir = os.path.join(input_dir, 'hosepen')
        if os.path.exists(hosepen_dir):
            files = [f for f in os.listdir(hosepen_dir) if os.path.isfile(os.path.join(hosepen_dir, f))]
        
        return {
            "required": {
                "image": (sorted(files) if files else ["hosepen_export.png"], {"image_upload": True}),
            },
        }
    
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "load_image"
    CATEGORY = "hosepen"
    
    def load_image(self, image):
        """加载画板导出的图像"""
        import folder_paths
        import torch
        from PIL import Image
        import numpy as np
        import os
        
        # 从 hosepen 子文件夹加载图像
        image_path = folder_paths.get_annotated_filepath(image)
        if not os.path.exists(image_path):
            # 尝试从 hosepen 子文件夹加载
            input_dir = folder_paths.get_input_directory()
            image_path = os.path.join(input_dir, 'hosepen', image)
        
        if not os.path.exists(image_path):
            # 如果文件不存在，返回空白图像
            blank = torch.zeros((1, 512, 512, 3), dtype=torch.float32)
            return (blank,)
        
        # 加载图像
        img = Image.open(image_path)
        img = img.convert("RGB")
        img_array = np.array(img).astype(np.float32) / 255.0
        img_tensor = torch.from_numpy(img_array)[None,]
        
        return (img_tensor,)
    
    @classmethod
    def IS_CHANGED(cls, image):
        import folder_paths
        import os
        image_path = folder_paths.get_annotated_filepath(image)
        if not os.path.exists(image_path):
            input_dir = folder_paths.get_input_directory()
            image_path = os.path.join(input_dir, 'hosepen', image)
        
        if os.path.exists(image_path):
            m = os.path.getmtime(image_path)
            return m
        return float("NaN")


# 节点映射
NODE_CLASS_MAPPINGS = {
    "HosepenNode": HosepenNode,
    "HosepenImageInput": HosepenImageInput,
    "HosepenImageOutput": HosepenImageOutput
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HosepenNode": "Hosepen Drawing",
    "HosepenImageInput": "Hosepen Image Input",
    "HosepenImageOutput": "Hosepen Image Output"
}
