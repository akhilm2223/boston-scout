import { useState } from "react";

interface StepOneProps {
    data: Record<string, any>;
    onChange: (data: Record<string, any>) => void;
}

export default function StepOne ({ data, onChange }: StepOneProps) {
    const formData = data;

    return <div>YOOO</div>
}