import React from 'react';

type ButtonProps = {
  onPress: () => void;
  title: string;
};

const Button: React.FC<ButtonProps> = ({ onPress, title }) => (
  <button onClick={onPress}>{title}</button>
);

export default Button;
