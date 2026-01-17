import { useState } from "react";

interface StepProps {
    data: Record<string, any>;
    onChange: (data: Record<string, any>) => void;
}

export default function StepTwo ({ data, onChange }: StepProps) {
    const formData = data;

    return <div>YOOO2</div>
}