ALTER TABLE signals DROP CONSTRAINT signals_status_check;
ALTER TABLE signals ADD CONSTRAINT signals_status_check CHECK (status = ANY (ARRAY['active'::text, 'monitoring'::text, 'ready'::text, 'triggered'::text, 'invalidated'::text, 'closed'::text, 'expired'::text]));

INSERT INTO signals (pair, timeframe, direction, setup_type, entry_price, stop_loss, take_profit_1, take_profit_2, take_profit_3, confidence, verdict, status, ai_reasoning, invalidation_reason)
VALUES
('EUR/USD', '4H', 'long', 'Bullish Engulfing', 1.0850, 1.0810, 1.0920, 1.0960, 1.1000, 82, 'trade', 'active', 'Strong bullish momentum with higher lows forming on the 4H chart. RSI divergence suggests continuation.', 'Close below 1.0800 on 4H'),
('GBP/USD', '1H', 'short', 'Head & Shoulders', 1.2650, 1.2700, 1.2580, 1.2530, NULL, 75, 'trade', 'monitoring', 'Classic H&S pattern with neckline break. Volume confirms distribution.', 'Break above 1.2720'),
('USD/JPY', 'D', 'long', 'Trendline Bounce', 149.50, 148.80, 150.80, 151.50, 152.00, 68, 'trade', 'ready', 'Price respecting ascending trendline on daily. BOJ policy unchanged.', 'Daily close below 148.50'),
('AUD/USD', '15m', 'short', NULL, 0.6520, 0.6545, 0.6485, 0.6460, NULL, 45, 'no_trade', 'invalidated', 'Weak setup with conflicting signals across timeframes.', 'Already invalidated by price action'),
('EUR/GBP', '4H', 'long', 'Double Bottom', 0.8580, 0.8550, 0.8630, 0.8660, NULL, 88, 'trade', 'triggered', 'Clean double bottom at key support with RSI oversold bounce.', 'Close below 0.8540'),
('USD/CAD', '1H', 'short', 'Bearish Flag', 1.3620, 1.3660, 1.3570, 1.3530, 1.3500, 71, 'trade', 'closed', 'Bearish flag continuation after strong impulse move down.', NULL);