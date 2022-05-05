
SPECIAL_CARDS = {
	"12": 2,
	"40": 2
}

# CLUBS 1
# HEARTS 2
# SPADES 3
# DIAMONDS 4
def evaluatePoints(arr):
	dp = 0
	for card in arr:
		if card in SPECIAL_CARDS:
			dp += SPECIAL_CARDS[card]
			continue
		cardval = card[1]
		if cardval in ("A", "0", "J", "Q", "K"):
			dp += 1
	print(f"Point evaluation for {arr}: {dp}")
	return dp