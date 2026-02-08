import { InputHTMLAttributes, forwardRef } from "react";
import classNames from "classnames";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className, label, error, ...props }, ref) => {
		return (
			<div className="w-full">
				{label && (
					<label className="block text-sm font-medium text-text-muted mb-1.5">
						{label}
					</label>
				)}
				<div className="relative">
					<input
						ref={ref}
						className={classNames(
							"input-base",
							error ? "border-error focus:ring-error" : null,
							className
						)}
						{...props}
					/>
				</div>
				{error && <p className="mt-1 text-xs text-error">{error}</p>}
			</div>
		);
	}
);
Input.displayName = "Input";

export { Input };
