import React from "react";
import { FaChartLine, FaCheckCircle, FaLock, FaStore, FaTimes } from "react-icons/fa";
import "./LockedCard.css";

const OwnerProLockedCard = React.forwardRef(
  (
    {
      title = "Функция за собственици",
      message = "Завършете настройките, за да отключите този бизнес инструмент за вашия водоем.",
      bullets = [],
      onUpgrade,
      onClose,
      compact = false,
      className = "",
      closeLabel = "Затвори прозореца за собственически функции",
      buttonLabel = "Към настройките",
    },
    ref
  ) => {
    const handleUpgrade = (event) => {
      event.stopPropagation();
      onUpgrade?.(event);
    };

    const handleClose = (event) => {
      event.stopPropagation();
      onClose?.(event);
    };

    return (
      <div
        ref={ref}
        className={`locked-card locked-card--owner${compact ? " locked-card--compact" : ""}${className ? ` ${className}` : ""}`}
      >
        <div className="locked-card__glow locked-card__glow--owner" />

        {onClose ? (
          <button type="button" onClick={handleClose} aria-label={closeLabel} className="locked-card__close">
            <FaTimes />
          </button>
        ) : null}

        <div className="locked-card__content">
          <div className="locked-card__badge locked-card__badge--owner">
            <FaStore /> Собственическа функция
          </div>

          <div className="locked-card__layout">
            <div className="locked-card__icon locked-card__icon--owner">
              <FaLock />
            </div>
            <div className="locked-card__body">
              <h3 className="locked-card__title">{title}</h3>
              <p className="locked-card__message">{message}</p>
              {bullets.length > 0 ? (
                <ul className="locked-card__list">
                  {bullets.map((bullet) => (
                    <li key={bullet}>
                      <FaCheckCircle className="locked-card__check" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button type="button" onClick={handleUpgrade} className="locked-card__button locked-card__button--owner">
                <FaChartLine /> {buttonLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default OwnerProLockedCard;
